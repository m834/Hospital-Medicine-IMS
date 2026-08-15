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
  durationMs: number;
}
