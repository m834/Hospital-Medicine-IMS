import { describeDumpFailure } from './dump-failure.util';

describe('describeDumpFailure', () => {
  it('names both versions on a client/server mismatch', () => {
    const stderr =
      'pg_dump: error: server version: 17.2 (Debian 17.2-1); pg_dump version: 16.14\n' +
      'pg_dump: error: aborting because of server version mismatch';

    const msg = describeDumpFailure(stderr, 1);

    expect(msg).toContain('16.14');
    expect(msg).toContain('17.2');
    // Points at the actual fix rather than just restating the problem
    expect(msg).toContain('postgresql17-client');
  });

  it('still explains a mismatch when the versions cannot be parsed', () => {
    const msg = describeDumpFailure('pg_dump: error: aborting because of server version mismatch', 1);
    expect(msg).toMatch(/version does not match/i);
  });

  it('reports a full disk', () => {
    expect(describeDumpFailure('pg_dump: error: could not write: No space left on device', 1))
      .toMatch(/out of disk space/i);
  });

  it('reports an unwritable directory', () => {
    expect(describeDumpFailure('pg_dump: error: permission denied for file', 1))
      .toMatch(/not allowed to write/i);
  });

  it('reports an unreachable database', () => {
    expect(describeDumpFailure('pg_dump: error: could not connect to server: Connection refused', 1))
      .toMatch(/could not reach the database/i);
  });

  it('reports bad credentials', () => {
    expect(describeDumpFailure('pg_dump: error: password authentication failed for user "x"', 1))
      .toMatch(/refused the credentials/i);
  });

  it('reports a cancelled dump', () => {
    expect(describeDumpFailure('ERROR: canceling statement due to statement timeout', 1))
      .toMatch(/cancelled the backup/i);
  });

  it('falls back to the exit code when the reason is unrecognised', () => {
    const msg = describeDumpFailure('something nobody has seen before', 42);
    expect(msg).toContain('42');
    expect(msg).toMatch(/server log/i);
  });

  it('copes with empty stderr', () => {
    expect(describeDumpFailure('', 1)).toContain('exit code 1');
  });

  it('never echoes the raw stderr back to the client', () => {
    // stderr can carry a connection string or a filesystem path
    const stderr = 'pg_dump: error: connection to postgresql://user:hunter2@10.0.0.5:5432/db failed';
    const msg = describeDumpFailure(stderr, 1);

    expect(msg).not.toContain('hunter2');
    expect(msg).not.toContain('10.0.0.5');
  });
});
