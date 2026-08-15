import { Transform } from 'stream';

/**
 * Drop `SET <param> = ...` lines naming a parameter the target server does not
 * know about.
 *
 * pg_dump writes a preamble of session settings, and it writes the ones ITS
 * version knows. A newer client dumping an older server therefore produces a
 * file the older server cannot read: pg_dump 17 emits
 * `SET transaction_timeout = 0;`, which exists only from PostgreSQL 17, and
 * PostgreSQL 16 rejects it. With ON_ERROR_STOP the whole load then aborts on
 * line 11 and nothing is created at all.
 *
 * These settings are session tuning — timeouts, quoting, search paths. Dropping
 * one the server never had changes nothing about the data that follows, so the
 * conservative move is to skip it and let the rest load.
 *
 * IMPORTANT: lines inside a COPY block are table DATA. A row whose first column
 * begins with "SET " would look exactly like a statement, so filtering is
 * suspended between `COPY ... FROM stdin;` and its terminating `\.`.
 */
export function createPreambleFilter(
  knownSettings: Set<string>,
  onDrop?: (line: string) => void,
): Transform {
  let buffer = '';
  let inCopy = false;

  // An empty set means the settings could not be read, not that the server
  // supports nothing. Filtering on it would strip every SET in the file and
  // break a dump that would otherwise have loaded, so do nothing instead.
  const filtering = knownSettings.size > 0;

  const handleLine = (line: string): string | null => {
    if (!filtering) return line;

    if (inCopy) {
      // Only the lone backslash-dot terminator ends a COPY block
      if (line === '\\.') inCopy = false;
      return line;
    }

    if (/^COPY .* FROM stdin;\s*$/.test(line)) {
      inCopy = true;
      return line;
    }

    const match = /^SET\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*=/.exec(line);
    if (match && !knownSettings.has(match[1].toLowerCase())) {
      onDrop?.(match[1]);
      return null;
    }

    return line;
  };

  return new Transform({
    transform(chunk, _enc, cb) {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      // The last element may be a partial line; hold it for the next chunk
      buffer = lines.pop() ?? '';

      let out = '';
      for (const line of lines) {
        const kept = handleLine(line);
        if (kept !== null) out += kept + '\n';
      }
      cb(null, out);
    },
    flush(cb) {
      if (buffer.length === 0) return cb();
      const kept = handleLine(buffer);
      cb(null, kept === null ? '' : kept);
    },
  });
}
