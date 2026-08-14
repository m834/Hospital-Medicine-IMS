/**
 * Backup filenames arrive from the client on download and delete, so they are
 * untrusted input used to build a filesystem path. Both helpers live here so
 * the rule is testable on its own rather than buried in a service that needs a
 * database and a child process to instantiate.
 */

/** mims-<db>-YYYYMMDD-HHMMSS.sql.gz — no separators, no traversal, one shape. */
const BACKUP_FILENAME = /^[A-Za-z0-9._-]+\.sql\.gz$/;

export function isValidBackupFilename(filename: string): boolean {
  if (!filename || !BACKUP_FILENAME.test(filename)) return false;

  // The character class already excludes "/", but "." and "-" are allowed, so
  // ".." and "..sql.gz" style names still have to be refused explicitly.
  if (filename.split('/').some((part) => part === '.' || part === '..')) return false;
  if (filename.startsWith('.')) return false;

  return true;
}

export function buildBackupFilename(database: string, when: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${when.getFullYear()}${p(when.getMonth() + 1)}${p(when.getDate())}` +
    `-${p(when.getHours())}${p(when.getMinutes())}${p(when.getSeconds())}`;
  // A database name may contain characters that are awkward in a filename, and
  // the result has to satisfy isValidBackupFilename above.
  const safeDb = database.replace(/[^A-Za-z0-9_-]/g, '') || 'db';
  return `mims-${safeDb}-${stamp}.sql.gz`;
}
