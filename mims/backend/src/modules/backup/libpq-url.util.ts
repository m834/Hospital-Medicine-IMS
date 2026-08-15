/**
 * Strip Prisma-only query parameters from a connection string so libpq tools
 * (psql, pg_dump) will accept it.
 *
 * DATABASE_URL routinely carries pool tuning — connection_limit, pool_timeout,
 * schema, pgbouncer — which Prisma understands and libpq does not. psql
 * refuses the entire string on the first unrecognised parameter with
 * "invalid URI query parameter", so the pool settings have to go; none of them
 * mean anything for a one-shot command anyway.
 */

const LIBPQ_PARAMS = new Set([
  'sslmode',
  'sslcert',
  'sslkey',
  'sslrootcert',
  'connect_timeout',
  'application_name',
  'options',
]);

export function toLibpqUrl(databaseUrl: string, overrideDatabase?: string): string {
  const u = new URL(databaseUrl);

  if (overrideDatabase) u.pathname = `/${overrideDatabase}`;

  for (const key of [...u.searchParams.keys()]) {
    if (!LIBPQ_PARAMS.has(key)) u.searchParams.delete(key);
  }

  return u.toString();
}
