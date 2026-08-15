import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { spawn } from 'child_process';
import { createReadStream } from 'fs';
import { unlink, open } from 'fs/promises';
import { createGunzip } from 'zlib';
import { PrismaService } from '../../database/prisma.service';
import { OperationalException } from '../../common/exceptions/operational.exception';
import { BackupService } from './backup.service';
import { RestoreReport, TableMergeResult, DeferredLink } from './restore.types';
import { toLibpqUrl } from './libpq-url.util';
import { createPreambleFilter } from './sql-preamble-filter';
import { TableSpec } from './merge-plan';
import { buildMergePlan } from './plan-builder';

/**
 * Merge-restore: bring rows that exist in a backup file but not in this
 * database, and change nothing that is already here.
 *
 * WHY IT IS NOT A RESTORE IN THE USUAL SENSE
 * Restoring a dump normally means replacing the database. That is not what is
 * wanted here — two live environments each hold real work, and the file is
 * used to carry what one has and the other lacks. So nothing is dropped,
 * updated or deleted: every table is INSERT-only.
 *
 * WHY IDs CANNOT BE TRUSTED
 * Primary keys are UUIDs generated independently in each environment, so the
 * same real medicine has different ids in the file and in this database.
 * Matching on id would duplicate everything. Rows are therefore matched on a
 * NATURAL key — what makes the thing itself — and every foreign key is
 * remapped from the file's id to the live id of the same row, which is why the
 * tables are processed parents-first.
 *
 * HOW IT RUNS
 * The dump is loaded into a scratch database and read through a second Prisma
 * client, so both sides are typed and the live database is only ever touched
 * by explicit inserts. The scratch database is dropped afterwards, and on
 * failure too.
 */
@Injectable()
export class RestoreService {
  private readonly logger = new Logger(RestoreService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly backupService: BackupService,
  ) {}

  private adminUrl(): { base: URL; database: string } {
    const raw = this.config.get<string>('DATABASE_URL');
    if (!raw) throw new OperationalException('DATABASE_URL is not configured on the server.');
    const base = new URL(raw);
    const database = base.pathname.replace(/^\//, '').split('?')[0];
    return { base, database };
  }

  /** A connection string for another database, safe to hand to psql. */
  private urlFor(dbName: string): string {
    const { base } = this.adminUrl();
    return toLibpqUrl(base.toString(), dbName);
  }

  /**
   * The scratch database is read by Prisma, not psql, so it keeps the pool
   * parameters that psql cannot take.
   */
  private prismaUrlFor(dbName: string): string {
    const { base } = this.adminUrl();
    const u = new URL(base.toString());
    u.pathname = `/${dbName}`;
    return u.toString();
  }

  private async psql(dbName: string, sql: string): Promise<void> {
    await this.runPsql(['--dbname', this.urlFor(dbName), '--command', sql]);
  }

  /** Every session setting this server recognises, lower-cased. */
  private async knownSettings(dbName: string): Promise<Set<string>> {
    return new Promise((resolve) => {
      const child = spawn('psql', [
        '--dbname', this.urlFor(dbName),
        '--tuples-only', '--no-align',
        '--command', 'select name from pg_settings',
      ]);

      let out = '';
      child.stdout.on('data', (c) => { out += c.toString(); });
      // A failure here must not stop the restore: an empty set simply means
      // nothing gets filtered, which is the behaviour we had before.
      child.on('error', () => resolve(new Set()));
      child.on('close', () =>
        resolve(new Set(out.split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean))),
      );
    });
  }

  private runPsql(args: string[], stdinFrom?: NodeJS.ReadableStream): Promise<void> {
    return new Promise((resolve, reject) => {
      // ON_ERROR_STOP so a failed statement fails the load rather than
      // leaving a half-populated scratch database that looks usable.
      const child = spawn('psql', ['--quiet', '--set', 'ON_ERROR_STOP=1', ...args], {
        env: { ...process.env },
      });

      let stderr = '';
      child.stderr.on('data', (c) => {
        if (stderr.length < 4000) stderr += c.toString();
      });

      child.on('error', (err: NodeJS.ErrnoException) => {
        reject(
          err.code === 'ENOENT'
            ? new OperationalException(
                'The restore tool (psql) is not installed in the application container.',
              )
            : err,
        );
      });

      child.on('close', (code) => {
        if (code === 0) return resolve();
        this.logger.error(`psql exited ${code}: ${stderr.trim() || 'no output'}`);
        reject(
          new OperationalException(
            `The backup file could not be read (psql exit ${code}). ` +
              'Check it is a backup produced by this system. The full reason is in the server log.',
          ),
        );
      });

      if (stdinFrom) {
        stdinFrom.pipe(child.stdin);
        stdinFrom.on('error', () => child.kill());
      } else {
        child.stdin.end();
      }
    });
  }

  /**
   * Is this file gzipped? Read the magic bytes rather than trusting the name.
   *
   * A dump may arrive as .sql.gz from this app, as plain .sql from pg_dump run
   * by hand, or renamed by whoever copied it between environments. Sniffing
   * two bytes is exact where an extension is a guess.
   */
  private async isGzipped(path: string): Promise<boolean> {
    const handle = await open(path, 'r');
    try {
      const { buffer, bytesRead } = await handle.read(Buffer.alloc(2), 0, 2, 0);
      return bytesRead === 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
    } finally {
      await handle.close();
    }
  }

  /**
   * Load the uploaded dump into a throwaway database.
   * Named with a timestamp so a crashed run leaves an obvious orphan rather
   * than colliding with the next attempt.
   */
  private async loadIntoScratch(dumpPath: string): Promise<string> {
    const scratch = `mims_restore_${Date.now()}`;
    const { database } = this.adminUrl();

    // CREATE DATABASE cannot run inside a transaction, so it goes through the
    // app's own database as the connection point.
    await this.psql(database, `CREATE DATABASE "${scratch}"`);

    try {
      const gzipped = await this.isGzipped(dumpPath);
      this.logger.log(`Loading ${gzipped ? 'gzipped' : 'plain'} dump into ${scratch}`);

      // The dump may name session settings this server has never heard of —
      // a newer pg_dump writing for a newer server. Ask what it accepts and
      // drop the rest, or the load aborts on the preamble and creates nothing.
      const known = await this.knownSettings(scratch);
      const dropped = new Set<string>();

      const raw = createReadStream(dumpPath);
      const decompressed = gzipped ? raw.pipe(createGunzip()) : raw;
      const stream = decompressed.pipe(
        createPreambleFilter(known, (name) => dropped.add(name)),
      );

      await this.runPsql(['--dbname', this.urlFor(scratch)], stream);

      if (dropped.size > 0) {
        this.logger.log(
          `Ignored settings this server does not support: ${[...dropped].join(', ')}`,
        );
      }
      return scratch;
    } catch (err) {
      await this.dropScratch(scratch);
      throw err;
    }
  }

  private async dropScratch(scratch: string): Promise<void> {
    try {
      const { database } = this.adminUrl();
      await this.psql(
        database,
        `DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`,
      );
    } catch {
      // An orphan scratch database wastes space but breaks nothing, and must
      // never mask the real error from the restore itself.
      this.logger.warn(`Could not drop scratch database ${scratch}`);
    }
  }

  async restore(
    dumpPath: string,
    sourceFile: string,
    dryRun: boolean,
    user: { id: string; fullName?: string; email?: string; role?: string },
  ): Promise<RestoreReport> {
    const startedAt = Date.now();
    this.logger.log(
      `Restore ${dryRun ? '(preview)' : '(APPLY)'} from ${sourceFile} by ${user.id}`,
    );

    // Applying is the irreversible half, so take a backup of the current state
    // first. A preview changes nothing and needs none.
    let safetyBackup: string | undefined;
    if (!dryRun) {
      const made = await this.backupService.create({ ...user, fullName: `${user.fullName ?? user.id} (pre-restore)` });
      safetyBackup = made.filename;
      this.logger.log(`Safety backup before restore: ${safetyBackup}`);
    }

    const scratch = await this.loadIntoScratch(dumpPath);
    const source = new PrismaClient({ datasources: { db: { url: this.prismaUrlFor(scratch) } } });

    // Declared outside the try so a failure can still report how far it got.
    const tables: TableMergeResult[] = [];

    try {

      // Parents first: each step needs the earlier steps' id translations to
      // repoint foreign keys from the file's ids to this database's.
      const plan = buildMergePlan();
      this.logger.log(`Merging ${plan.length} tables`);

      const maps = new Map<string, Map<string, string>>();
      // Links that could not be resolved when the row was written, because
      // what they point at is placed later in the order.
      const pending: DeferredLink[] = [];

      for (const spec of plan) {
        const result = await this.mergeTable(source, spec, maps, dryRun, user.id, pending);
        // A schema of this size means most tables are empty in any given file;
        // listing sixty untouched rows would bury the ones that matter.
        if (result.inBackup > 0) tables.push(result);
      }

      const relinked = dryRun ? 0 : await this.relink(pending, maps);
      if (relinked > 0) this.logger.log(`Re-linked ${relinked} deferred reference(s)`);

      return {
        dryRun,
        sourceFile,
        safetyBackup,
        relinked,
        tables,
        totalInserted: tables.reduce((sum, t) => sum + t.inserted, 0),
        durationMs: Date.now() - startedAt,
      };
    } catch (err) {
      // A merge failure would otherwise reach the client as a bare 500 with no
      // hint of which table or which row. Name what was reached and how far it
      // got, and log the underlying error in full.
      const e = err as Error & { code?: string; meta?: any };
      const done = tables.map((t) => `${t.table} +${t.inserted}`).join(', ') || 'none';
      this.logger.error(
        `Restore failed after [${done}] — ${e.code ?? ''} ${e.message}`,
        e.stack,
      );

      const where = tables.length > 0 ? ` The last table completed was ${tables[tables.length - 1].table}.` : '';
      throw new OperationalException(
        `The merge stopped partway.${where} Nothing after that point was added, ` +
          `and a safety backup was taken first${safetyBackup ? ` (${safetyBackup})` : ''}. ` +
          'The reason is in the server log.',
      );
    } finally {
      await source.$disconnect().catch(() => undefined);
      await this.dropScratch(scratch);
      await unlink(dumpPath).catch(() => undefined);
    }
  }

  private blank(table: string, inBackup: number): TableMergeResult {
    return { table, inBackup, alreadyPresent: 0, inserted: 0, skipped: 0, skipReasons: [] };
  }

  private note(r: TableMergeResult, reason: string) {
    r.skipped += 1;
    if (r.skipReasons.length < 10 && !r.skipReasons.includes(reason)) r.skipReasons.push(reason);
  }

  /**
   * Fill in the references that could not be resolved when their row was
   * written. A user is placed before pharmacies exist, so their pharmacy is
   * left empty and set here — without this every merged user would arrive
   * with no pharmacy, no department and no ward, which for twenty pharmacies
   * of staff is the difference between usable and not.
   *
   * A link that still cannot be resolved is left empty rather than guessed at.
   */
  private async relink(
    pending: DeferredLink[],
    maps: Map<string, Map<string, string>>,
  ): Promise<number> {
    let done = 0;

    for (const link of pending) {
      if (!link.newId) continue;

      const target = maps.get(link.mapKey)?.get(link.sourceValue);
      if (!target) continue;

      try {
        await (this.prisma as any)[link.model].update({
          where: { id: link.newId },
          data: { [link.column]: target },
        });
        done += 1;
      } catch (err) {
        // One unresolvable link must not undo a merge that otherwise worked
        this.logger.warn(
          `Could not re-link ${link.model}.${link.column}: ${(err as Error).message}`,
        );
      }
    }

    return done;
  }

  /**
   * Merge one table according to its spec.
   *
   * Prisma's delegates are reached by name here, which gives up compile-time
   * types for this one function. The alternative was twenty near-identical
   * hand-written mergers, where the risk is not a type error but one of them
   * quietly forgetting a foreign key — which is exactly the bug that reached
   * production. One reviewed routine driven by a declared plan is the safer
   * shape, and merge-plan.ts stays readable to someone who does not know
   * Prisma.
   */
  private async mergeTable(
    source: PrismaClient,
    spec: TableSpec,
    maps: Map<string, Map<string, string>>,
    dryRun: boolean,
    importedBy: string,
    pending: DeferredLink[],
  ): Promise<TableMergeResult> {
    const src = (source as any)[spec.model];
    const live = (this.prisma as any)[spec.model];

    const rows: any[] = await src.findMany();
    const result = this.blank(spec.label, rows.length);
    const idMap = new Map<string, string>();

    for (const row of rows) {
      const data: any = { ...row };
      let blocked: string | null = null;

      // Repoint every foreign key onto this database's row
      for (const [column, mapKey] of Object.entries(spec.remap ?? {})) {
        const original = row[column];
        if (original == null) continue;

        const translated = maps.get(mapKey)?.get(original);
        if (translated) {
          data[column] = translated;
          continue;
        }

        if (spec.userFallback?.includes(column)) {
          // Required, and whoever did it in the other system is not here —
          // attribute it to the person running the restore rather than lose
          // the record entirely.
          data[column] = importedBy;
        } else if (spec.nullable?.includes(column)) {
          // Empty for now. A user is placed before pharmacies exist, so their
          // pharmacy cannot be resolved yet — note it and fill it in once
          // everything is down, or every user would arrive unassigned.
          data[column] = null;
          pending.push({ model: spec.model, column, mapKey, sourceValue: original, sourceRowId: row.id });
        } else {
          blocked = `${column} refers to a ${mapKey} that is not in this database`;
          break;
        }
      }

      if (blocked) {
        this.note(result, blocked);
        continue;
      }

      // Already here?
      const existing =
        spec.strategy === 'id'
          ? await live.findUnique({ where: { id: row.id } })
          : await live.findFirst({
              where: Object.fromEntries(
                (spec.naturalKey ?? []).map((k) => [k, data[k] ?? null]),
              ),
            });

      if (existing) {
        idMap.set(row.id, existing.id);
        result.alreadyPresent += 1;
        continue;
      }

      if (dryRun) {
        result.inserted += 1;
        // A preview still has to translate ids, or every child would look
        // blocked because its parent "does not exist yet".
        idMap.set(row.id, row.id);
        continue;
      }

      // Transactional rows keep their id — it is their identity, and keeping
      // it makes a second run find them rather than duplicate them. Reference
      // rows take a fresh one, since the same thing already exists here under
      // a different id.
      if (spec.strategy === 'natural') delete data.id;

      const created = await live.create({ data });
      idMap.set(row.id, created.id);
      // Point any deferred link for this row at the id it actually got
      for (const link of pending) {
        if (link.model === spec.model && link.sourceRowId === row.id) link.newId = created.id;
      }
      result.inserted += 1;
    }

    if (spec.mapKey) maps.set(spec.mapKey, idMap);
    return result;
  }
}
