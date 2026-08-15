import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { createWriteStream, createReadStream, constants as fsConstants } from 'fs';
import { mkdir, readdir, readFile, writeFile, stat, unlink, access, statfs } from 'fs/promises';
import { join, resolve } from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { isValidBackupFilename, buildBackupFilename } from './backup-filename.util';
import { OperationalException } from '../../common/exceptions/operational.exception';
import { describeDumpFailure } from './dump-failure.util';

export interface BackupManifest {
  filename: string;
  database: string;
  sizeBytes: number;
  createdAt: string;
  durationMs: number;
  triggeredBy: {
    id: string;
    fullName?: string;
    email?: string;
    role?: string;
  };
}

interface DbConnection {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

/**
 * Full-database backups, triggered from the Super Admin panel.
 *
 * Dumps are written to disk rather than streamed straight to the browser: the
 * file has to outlive the request so it can be listed, re-downloaded, and fed
 * to the sync/merge flow later. BACKUP_DIR must be a mounted volume — a path
 * inside the container alone would lose every backup on the next deploy, which
 * for a backup feature is the one failure that matters.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;

  constructor(private readonly config: ConfigService) {
    this.backupDir = this.config.get<string>('BACKUP_DIR') || '/app/backups';
  }

  /**
   * Postgres only. Prisma's datasource is postgresql and every deployment of
   * this system runs postgres:16 — there is no SQL Server instance to detect,
   * so a .bak branch here would be code that never executes.
   */
  private parseDatabaseUrl(): DbConnection {
    const url = this.config.get<string>('DATABASE_URL');
    if (!url) {
      throw new InternalServerErrorException('DATABASE_URL is not configured');
    }

    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: parsed.port || '5432',
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: parsed.pathname.replace(/^\//, '').split('?')[0],
      };
    } catch {
      throw new InternalServerErrorException('DATABASE_URL is malformed');
    }
  }

  /**
   * Resolve a client-supplied filename to a path, refusing anything that
   * escapes the backup directory. Both the name check and the resolved-prefix
   * check are kept: either alone has a gap the other closes.
   */
  private resolveBackupPath(filename: string): string {
    if (!isValidBackupFilename(filename)) {
      throw new BadRequestException('Invalid backup filename');
    }
    const full = resolve(join(this.backupDir, filename));
    if (!full.startsWith(resolve(this.backupDir) + '/')) {
      throw new BadRequestException('Invalid backup filename');
    }
    return full;
  }

  private manifestPathFor(backupPath: string): string {
    return backupPath.replace(/\.sql\.gz$/, '.json');
  }

  /**
   * Fail before starting, with a reason, rather than part-way through with a
   * stack. Each of these has actually bitten: the bind-mounted directory is
   * root-owned while the app runs as another user, or the disk is too full to
   * hold a dump that a small database never came close to filling.
   */
  private async assertCanWriteBackups(): Promise<void> {
    try {
      await mkdir(this.backupDir, { recursive: true });
    } catch {
      throw new OperationalException(
        `The backups directory (${this.backupDir}) could not be created on the server.`,
      );
    }

    try {
      await access(this.backupDir, fsConstants.W_OK);
    } catch {
      throw new OperationalException(
        `The backups directory (${this.backupDir}) is not writable by the application. ` +
          'On a Docker deployment the mounted folder must be owned by the container user.',
      );
    }

    // statfs is not on every platform; a failure to measure must not block a
    // backup that would otherwise succeed.
    try {
      const fsStat = await statfs(this.backupDir);
      const freeBytes = fsStat.bavail * fsStat.bsize;
      const freeMb = Math.floor(freeBytes / (1024 * 1024));
      if (freeMb < 200) {
        throw new OperationalException(
          `Only ${freeMb} MB of disk space is free where backups are written. Free space and try again.`,
        );
      }
      this.logger.log(`Backup preflight OK — ${freeMb} MB free at ${this.backupDir}`);
    } catch (err) {
      if (err instanceof OperationalException) throw err;
      this.logger.warn(`Could not measure free disk space at ${this.backupDir}`);
    }
  }

  async create(user: {
    id: string;
    fullName?: string;
    email?: string;
    role?: string;
  }): Promise<BackupManifest> {
    const db = this.parseDatabaseUrl();
    const startedAt = new Date();
    const filename = buildBackupFilename(db.database, startedAt);

    await this.assertCanWriteBackups();
    const target = join(this.backupDir, filename);

    this.logger.log(`Backup started by ${user.id} → ${filename}`);

    // --no-owner/--no-privileges keep the dump restorable into an instance
    // whose role names differ, which is the whole point of moving one between
    // the local server and cloud.
    const args = [
      '--host', db.host,
      '--port', db.port,
      '--username', db.user,
      '--dbname', db.database,
      '--format', 'plain',
      '--no-owner',
      '--no-privileges',
    ];

    const child = spawn('pg_dump', args, {
      // Password by env, never on the command line where `ps` would show it
      env: { ...process.env, PGPASSWORD: db.password },
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      // Cap it: a failing pg_dump can produce a lot, and this ends up in an
      // error message, not a log file
      if (stderr.length < 4000) stderr += chunk.toString();
    });

    const exited = new Promise<number>((res, rej) => {
      child.on('error', (err: NodeJS.ErrnoException) => {
        rej(
          err.code === 'ENOENT'
            ? new OperationalException(
                'The backup tool (pg_dump) is not installed in the application container. ' +
                  'The backend image needs a postgresql client matching the database version.',
              )
            : err,
        );
      });
      child.on('close', (code) => res(code ?? 1));
    });

    try {
      // Gzip in-process rather than through a shell pipe: no shell means no
      // quoting surface, and memory stays flat regardless of database size.
      await Promise.all([
        pipeline(child.stdout, createGzip(), createWriteStream(target)),
        exited.then((code) => {
          if (code !== 0) {
            // Full stderr to the log, a usable sentence to the client.
            this.logger.error(`pg_dump exited ${code}: ${stderr.trim() || 'no output'}`);
            throw new OperationalException(describeDumpFailure(stderr, code));
          }
        }),
      ]);
    } catch (err) {
      // Never leave a truncated file looking like a usable backup
      await unlink(target).catch(() => undefined);

      if (err instanceof OperationalException) throw err;

      // Anything else — a write that failed mid-stream, a disk filling up
      // during the dump — still has to arrive as something actionable.
      const e = err as NodeJS.ErrnoException;
      this.logger.error(`Backup failed (${e.code ?? 'unknown'}): ${e.message}`, e.stack);

      if (e.code === 'ENOSPC') {
        throw new OperationalException(
          'The server ran out of disk space while writing the backup. Free space and try again.',
        );
      }
      if (e.code === 'EACCES' || e.code === 'EPERM') {
        throw new OperationalException(
          `The server was not allowed to write to ${this.backupDir}. The backups directory must be writable by the application user.`,
        );
      }
      throw new OperationalException(
        'The backup could not be written. The reason is in the server log.',
      );
    }

    const { size } = await stat(target);
    const manifest: BackupManifest = {
      filename,
      database: db.database,
      sizeBytes: size,
      createdAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      triggeredBy: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    };

    // Sidecar rather than a database table, deliberately: a backup listing
    // that depends on the database is useless in the situation backups exist
    // for. The audit log remains the authoritative record of who and when.
    await writeFile(this.manifestPathFor(target), JSON.stringify(manifest, null, 2), 'utf8');

    this.logger.log(`Backup complete: ${filename} (${size} bytes, ${manifest.durationMs}ms)`);
    return manifest;
  }

  async list(): Promise<BackupManifest[]> {
    await mkdir(this.backupDir, { recursive: true });
    const entries = await readdir(this.backupDir);
    const dumps = entries.filter((f) => f.endsWith('.sql.gz'));

    const manifests = await Promise.all(
      dumps.map(async (filename) => {
        const full = join(this.backupDir, filename);
        try {
          const raw = await readFile(this.manifestPathFor(full), 'utf8');
          return JSON.parse(raw) as BackupManifest;
        } catch {
          // A dump with no manifest is still a backup — most likely one taken
          // from the shell. Report what the filesystem knows rather than hide
          // it, since hiding it is how a restore ends up missing a file.
          const info = await stat(full).catch(() => null);
          if (!info) return null;
          return {
            filename,
            database: 'unknown',
            sizeBytes: info.size,
            createdAt: info.mtime.toISOString(),
            durationMs: 0,
            triggeredBy: { id: 'unknown', fullName: 'Taken outside the app' },
          } as BackupManifest;
        }
      }),
    );

    return manifests
      .filter((m): m is BackupManifest => m !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Path + size for streaming a download. Throws if it is not there. */
  async getForDownload(filename: string): Promise<{ path: string; size: number }> {
    const path = this.resolveBackupPath(filename);
    const info = await stat(path).catch(() => null);
    if (!info) throw new NotFoundException('Backup not found');
    return { path, size: info.size };
  }

  createReadStream(path: string) {
    return createReadStream(path);
  }

  async remove(filename: string): Promise<{ filename: string }> {
    const path = this.resolveBackupPath(filename);
    const info = await stat(path).catch(() => null);
    if (!info) throw new NotFoundException('Backup not found');

    await unlink(path);
    await unlink(this.manifestPathFor(path)).catch(() => undefined);

    this.logger.log(`Backup deleted: ${filename}`);
    return { filename };
  }
}
