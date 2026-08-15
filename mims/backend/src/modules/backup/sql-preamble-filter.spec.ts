import { Readable } from 'stream';
import { createPreambleFilter } from './sql-preamble-filter';

// A PostgreSQL 16 server: knows statement_timeout, has never heard of
// transaction_timeout (added in 17).
const PG16 = new Set(['statement_timeout', 'lock_timeout', 'client_encoding', 'search_path']);

async function run(
  sql: string,
  known = PG16,
  chunkSize = 1024,
): Promise<{ out: string; dropped: string[] }> {
  const dropped: string[] = [];
  const src = new Readable({ read() {} });

  const filtered = src.pipe(createPreambleFilter(known, (n) => dropped.push(n)));

  const done = new Promise<string>((resolve, reject) => {
    let out = '';
    filtered.on('data', (c) => { out += c.toString(); });
    filtered.on('end', () => resolve(out));
    filtered.on('error', reject);
  });

  for (let i = 0; i < sql.length; i += chunkSize) {
    src.push(sql.slice(i, i + chunkSize));
  }
  src.push(null);

  return { out: await done, dropped };
}

describe('createPreambleFilter', () => {
  it('drops a setting the server does not know', async () => {
    const { out, dropped } = await run(
      'SET statement_timeout = 0;\nSET transaction_timeout = 0;\nSELECT 1;\n',
    );

    expect(out).toContain('SET statement_timeout = 0;');
    expect(out).not.toContain('transaction_timeout');
    expect(dropped).toEqual(['transaction_timeout']);
  });

  it('leaves a dump alone when every setting is recognised', async () => {
    const sql = 'SET statement_timeout = 0;\nSET lock_timeout = 0;\nSELECT 1;\n';
    const { out, dropped } = await run(sql);

    expect(out).toBe(sql);
    expect(dropped).toEqual([]);
  });

  it('never filters inside COPY data, even a row starting with SET', async () => {
    // A medicine literally named "SET transaction_timeout = 0;" would be
    // dropped by a naive filter, silently losing a row
    const sql =
      'SET transaction_timeout = 0;\n' +
      'COPY public.medicines (id, name) FROM stdin;\n' +
      '1\tSET transaction_timeout = 0;\n' +
      '2\tPanadol\n' +
      '\\.\n' +
      'SET transaction_timeout = 0;\n';

    const { out } = await run(sql);

    // Both preamble lines dropped, the data row kept intact
    expect(out).toContain('1\tSET transaction_timeout = 0;');
    expect(out).toContain('2\tPanadol');
    expect(out.match(/^SET transaction_timeout/gm)).toBeNull();
  });

  it('resumes filtering after a COPY block ends', async () => {
    const sql =
      'COPY public.x (a) FROM stdin;\n' +
      'data\n' +
      '\\.\n' +
      'SET transaction_timeout = 0;\n' +
      'SELECT 1;\n';

    const { out, dropped } = await run(sql);

    expect(dropped).toEqual(['transaction_timeout']);
    expect(out).toContain('data');
    expect(out).toContain('SELECT 1;');
  });

  it('survives being split mid-line across chunks', async () => {
    const sql =
      'SET statement_timeout = 0;\nSET transaction_timeout = 0;\nCOPY public.x (a) FROM stdin;\nrow\n\\.\n';

    // One byte at a time — every line boundary lands inside a chunk
    const { out, dropped } = await run(sql, PG16, 1);

    expect(dropped).toEqual(['transaction_timeout']);
    expect(out).toContain('SET statement_timeout = 0;');
    expect(out).toContain('row');
  });

  it('keeps a final line with no trailing newline', async () => {
    const { out } = await run('SELECT 1;');
    expect(out).toBe('SELECT 1;');
  });

  it('filters nothing when the settings list could not be read', async () => {
    const sql = 'SET transaction_timeout = 0;\nSELECT 1;\n';
    const { out, dropped } = await run(sql, new Set());

    // An empty set means "unknown", so behave as before rather than strip
    // every setting in the file
    expect(dropped).toEqual([]);
    expect(out).toBe(sql);
  });

  it('is case-insensitive about the parameter name', async () => {
    const { dropped } = await run('SET Transaction_Timeout = 0;\n');
    expect(dropped).toEqual(['Transaction_Timeout']);
  });
});
