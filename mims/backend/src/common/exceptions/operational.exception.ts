import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * A failure the operator can actually act on — a missing tool, a full disk, an
 * unwritable directory, a database that refused the connection.
 *
 * Ordinary 5xx messages are replaced with a generic line before they leave the
 * server, which is right for unexpected crashes: their messages carry stack
 * details and internal paths. But it makes an operational failure impossible
 * to diagnose from the client, which is how a backup could fail with nothing
 * to go on but "please try again".
 *
 * The message on this exception is written FOR the user, states no internals,
 * and is marked safe so the global filter passes it through untouched. Never
 * put a raw stack, query, path or credential in one.
 */
export class OperationalException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR) {
    super({ message, error: 'OperationalError', safe: true }, status);
  }
}
