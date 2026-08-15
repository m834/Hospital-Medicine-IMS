/**
 * Shapes for the merge-restore. Kept apart from the service so the report the
 * UI renders and the service produces cannot drift.
 */

export interface TableMergeResult {
  /** Human name shown in the UI, e.g. "Medicines" */
  table: string;
  /** Rows present in the backup file */
  inBackup: number;
  /** Rows already present live, matched on the natural key */
  alreadyPresent: number;
  /** Rows that were (or would be) inserted */
  inserted: number;
  /** Rows that could not be placed — usually a parent that is itself missing */
  skipped: number;
  /** Why rows were skipped, capped so a broken file cannot flood the response */
  skipReasons: string[];
}

export interface RestoreReport {
  dryRun: boolean;
  /** Filename as uploaded */
  sourceFile: string;
  /** Safety backup taken before applying; absent on a dry run */
  safetyBackup?: string;
  tables: TableMergeResult[];
  totalInserted: number;
  /** References filled in on the second pass, once every table was placed */
  relinked?: number;
  durationMs: number;
}

/**
 * A foreign key that could not be filled when its row was written, because the
 * table it points at is placed later in the order. Resolved in a second pass.
 */
export interface DeferredLink {
  model: string;
  column: string;
  /** which id map holds the translation */
  mapKey: string;
  /** the id as it appears in the backup file */
  sourceValue: string;
  /** the row's id in the file, used to attach newId once it is created */
  sourceRowId: string;
  /** the id the row was actually given here */
  newId?: string;
}
