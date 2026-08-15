/**
 * Turn a pg_dump failure into something the operator can act on.
 *
 * pg_dump's own stderr is accurate but assumes you know Postgres, and it may
 * carry a connection string or path. Each branch below maps a known failure to
 * a sentence that says what to do, without echoing anything internal — these
 * messages are sent to the browser.
 *
 * Anything unrecognised falls through to a generic line plus the exit code;
 * the raw stderr is logged server-side, never returned.
 */
export function describeDumpFailure(stderr: string, exitCode: number): string {
  const s = (stderr || '').toLowerCase();

  // The one that bites when a bigger, older or newer instance is dumped by a
  // client of the wrong major version — pg_dump refuses rather than risk a
  // bad dump.
  const versionMismatch = /server version:?\s*([\d.]+).*?pg_dump version:?\s*([\d.]+)/s.exec(stderr);
  if (versionMismatch || s.includes('aborting because of server version mismatch')) {
    const serverV = versionMismatch?.[1];
    const toolV = versionMismatch?.[2];
    return serverV && toolV
      ? `The backup tool is version ${toolV} but this database is version ${serverV}. ` +
        `The server image needs a matching postgresql client (postgresql${serverV.split('.')[0]}-client).`
      : 'The backup tool version does not match this database version. The server image needs a matching postgresql client.';
  }

  if (s.includes('no space left on device') || s.includes('enospc')) {
    return 'The server ran out of disk space while writing the backup. Free space and try again.';
  }

  if (s.includes('permission denied')) {
    return 'The server was not allowed to write the backup file. The backups directory must be writable by the application user.';
  }

  if (
    s.includes('could not connect') ||
    s.includes('connection refused') ||
    s.includes('could not translate host name')
  ) {
    return 'Could not reach the database to back it up. Check the database is running and reachable from the application.';
  }

  if (s.includes('password authentication failed') || s.includes('role') && s.includes('does not exist')) {
    return 'The database refused the credentials used for the backup. Check DATABASE_URL.';
  }

  if (s.includes('canceling statement due to statement timeout') || s.includes('timeout')) {
    return 'The database cancelled the backup before it finished, most likely a timeout on a large database.';
  }

  return `The backup command failed (exit code ${exitCode}). The full reason is in the server log.`;
}
