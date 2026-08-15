import { toLibpqUrl } from './libpq-url.util';

// The real production string, which psql rejected outright before this existed
const PROD =
  'postgresql://civil_user:secret@civil-postgres:5432/civil_mims_db' +
  '?connection_limit=20&pool_timeout=10&connect_timeout=10';

describe('toLibpqUrl', () => {
  it('drops the Prisma pool parameters psql refuses', () => {
    const out = toLibpqUrl(PROD);

    expect(out).not.toContain('connection_limit');
    expect(out).not.toContain('pool_timeout');
  });

  it('keeps parameters libpq understands', () => {
    // connect_timeout is valid for libpq and must survive
    expect(toLibpqUrl(PROD)).toContain('connect_timeout=10');
    expect(toLibpqUrl('postgresql://u:p@h:5432/db?sslmode=require')).toContain('sslmode=require');
  });

  it('keeps host, port, credentials and database', () => {
    const out = new URL(toLibpqUrl(PROD));

    expect(out.hostname).toBe('civil-postgres');
    expect(out.port).toBe('5432');
    expect(out.username).toBe('civil_user');
    expect(out.password).toBe('secret');
    expect(out.pathname).toBe('/civil_mims_db');
  });

  it('can point at a different database on the same server', () => {
    const out = new URL(toLibpqUrl(PROD, 'mims_restore_123'));

    expect(out.pathname).toBe('/mims_restore_123');
    expect(out.hostname).toBe('civil-postgres');
    expect(out.searchParams.get('connection_limit')).toBeNull();
  });

  it('drops the other Prisma-only parameters seen in the wild', () => {
    const out = toLibpqUrl('postgresql://u:p@h:5432/db?schema=public&pgbouncer=true&sslmode=require');

    expect(out).not.toContain('schema=');
    expect(out).not.toContain('pgbouncer');
    expect(out).toContain('sslmode=require');
  });

  it('leaves a clean url alone', () => {
    const clean = 'postgresql://u:p@h:5432/db';
    expect(toLibpqUrl(clean)).toBe(clean);
  });
});
