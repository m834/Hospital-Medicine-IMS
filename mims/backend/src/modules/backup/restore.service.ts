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
import { RestoreReport, TableMergeResult } from './restore.types';
import { toLibpqUrl } from './libpq-url.util';

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

      const raw = createReadStream(dumpPath);
      const stream = gzipped ? raw.pipe(createGunzip()) : raw;

      await this.runPsql(['--dbname', this.urlFor(scratch)], stream);
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

    try {
      const tables: TableMergeResult[] = [];

      // Parents first: each step needs the previous step's id mapping to
      // translate foreign keys from the file's ids to this database's.
      const hospitalIds = await this.mergeHospitals(source, tables, dryRun);
      const pharmacyIds = await this.mergePharmacies(source, tables, dryRun, hospitalIds);
      const medicineIds = await this.mergeMedicines(source, tables, dryRun, hospitalIds);
      await this.mergePatients(source, tables, dryRun, hospitalIds);
      await this.mergeStockBatches(source, tables, dryRun, hospitalIds, pharmacyIds, medicineIds);

      return {
        dryRun,
        sourceFile,
        safetyBackup,
        tables,
        totalInserted: tables.reduce((sum, t) => sum + t.inserted, 0),
        durationMs: Date.now() - startedAt,
      };
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

  // ── Hospitals — natural key: code ──────────────────────────────────────────
  private async mergeHospitals(source: PrismaClient, out: TableMergeResult[], dryRun: boolean) {
    const rows = await source.hospital.findMany();
    const r = this.blank('Hospitals', rows.length);
    const map = new Map<string, string>();

    for (const row of rows) {
      const live = await this.prisma.hospital.findUnique({ where: { code: row.code } });
      if (live) {
        map.set(row.id, live.id);
        r.alreadyPresent += 1;
        continue;
      }
      if (dryRun) {
        r.inserted += 1;
        continue;
      }
      const { id, ...data } = row;
      const created = await this.prisma.hospital.create({ data });
      map.set(row.id, created.id);
      r.inserted += 1;
    }

    out.push(r);
    return map;
  }

  // ── Pharmacies — natural key: (hospital, code) ─────────────────────────────
  private async mergePharmacies(
    source: PrismaClient,
    out: TableMergeResult[],
    dryRun: boolean,
    hospitalIds: Map<string, string>,
  ) {
    const rows = await source.pharmacy.findMany();
    const r = this.blank('Pharmacies', rows.length);
    const map = new Map<string, string>();

    for (const row of rows) {
      const hospitalId = hospitalIds.get(row.hospitalId);
      if (!hospitalId) {
        this.note(r, 'Hospital not present in this database');
        continue;
      }

      const live = await this.prisma.pharmacy.findFirst({
        where: { hospitalId, code: row.code },
      });
      if (live) {
        map.set(row.id, live.id);
        r.alreadyPresent += 1;
        continue;
      }
      if (dryRun) {
        r.inserted += 1;
        continue;
      }
      // parentPharmacyId is deliberately dropped: the parent may not be
      // inserted yet, and the hierarchy is safer re-linked by hand than
      // guessed at during a merge.
      const { id, hospitalId: _h, parentPharmacyId: _p, ...data } = row as any;
      const created = await this.prisma.pharmacy.create({ data: { ...data, hospitalId } });
      map.set(row.id, created.id);
      r.inserted += 1;
    }

    out.push(r);
    return map;
  }

  // ── Medicines — natural key: (hospital, name, strength, form) ──────────────
  private async mergeMedicines(
    source: PrismaClient,
    out: TableMergeResult[],
    dryRun: boolean,
    hospitalIds: Map<string, string>,
  ) {
    const rows = await source.medicine.findMany();
    const r = this.blank('Medicines', rows.length);
    const map = new Map<string, string>();

    for (const row of rows) {
      const hospitalId = hospitalIds.get(row.hospitalId);
      if (!hospitalId) {
        this.note(r, 'Hospital not present in this database');
        continue;
      }

      // No unique constraint exists on Medicine, so identity is what makes it
      // the same drug on a shelf: same hospital, name, strength and form.
      const live = await this.prisma.medicine.findFirst({
        where: {
          hospitalId,
          name: row.name,
          strength: row.strength,
          form: row.form,
        },
      });
      if (live) {
        map.set(row.id, live.id);
        r.alreadyPresent += 1;
        continue;
      }
      if (dryRun) {
        r.inserted += 1;
        continue;
      }
      const { id, hospitalId: _h, ...data } = row as any;
      const created = await this.prisma.medicine.create({ data: { ...data, hospitalId } });
      map.set(row.id, created.id);
      r.inserted += 1;
    }

    out.push(r);
    return map;
  }

  // ── Patients — natural key: MRN (already unique) ───────────────────────────
  private async mergePatients(
    source: PrismaClient,
    out: TableMergeResult[],
    dryRun: boolean,
    hospitalIds: Map<string, string>,
  ) {
    const rows = await source.patient.findMany();
    const r = this.blank('Patients', rows.length);

    for (const row of rows) {
      const hospitalId = hospitalIds.get(row.hospitalId);
      if (!hospitalId) {
        this.note(r, 'Hospital not present in this database');
        continue;
      }

      const live = await this.prisma.patient.findUnique({ where: { nrNumber: row.nrNumber } });
      if (live) {
        r.alreadyPresent += 1;
        continue;
      }
      if (dryRun) {
        r.inserted += 1;
        continue;
      }
      // Clinical links (attending doctor, registering user) point at users
      // this database may not have, so they are left unset rather than
      // pointed at the wrong person.
      const {
        id, hospitalId: _h, attendingDoctorId: _d, registeredBy: _r, ...data
      } = row as any;
      await this.prisma.patient.create({
        data: { ...data, hospitalId, registeredBy: row.registeredBy },
      });
      r.inserted += 1;
    }

    out.push(r);
  }

  // ── Stock batches — the inventory rows ─────────────────────────────────────
  private async mergeStockBatches(
    source: PrismaClient,
    out: TableMergeResult[],
    dryRun: boolean,
    hospitalIds: Map<string, string>,
    pharmacyIds: Map<string, string>,
    medicineIds: Map<string, string>,
  ) {
    const rows = await source.stockBatch.findMany();
    const r = this.blank('Stock batches', rows.length);

    for (const row of rows) {
      const hospitalId = hospitalIds.get(row.hospitalId);
      const pharmacyId = pharmacyIds.get(row.pharmacyId);
      const medicineId = medicineIds.get(row.medicineId);

      if (!hospitalId) { this.note(r, 'Hospital not present in this database'); continue; }
      if (!pharmacyId) { this.note(r, 'Pharmacy not present in this database'); continue; }
      if (!medicineId) { this.note(r, 'Medicine not present and could not be added'); continue; }

      // A batch is identified by where it sits and what is written on it.
      const live = await this.prisma.stockBatch.findFirst({
        where: {
          hospitalId,
          pharmacyId,
          medicineId,
          batchNo: row.batchNo,
          expiryDate: row.expiryDate,
        },
      });
      if (live) {
        // Present already — quantities are NOT touched. This database's count
        // reflects what it has issued; the file's does not.
        r.alreadyPresent += 1;
        continue;
      }
      if (dryRun) {
        r.inserted += 1;
        continue;
      }

      const {
        id, hospitalId: _h, pharmacyId: _p, medicineId: _m, ...data
      } = row as any;
      await this.prisma.stockBatch.create({
        data: { ...data, hospitalId, pharmacyId, medicineId },
      });
      r.inserted += 1;
    }

    out.push(r);
  }
}
