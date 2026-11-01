import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Lets a request through with or without a valid token: req.user is the
 * signed-in user when there is one, and empty otherwise. An error report must
 * be accepted from the login screen and from an expired session too — those
 * are exactly the moments worth hearing about.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // No token, or not a valid one: carry on as an anonymous report.
    }
    return true;
  }

  handleRequest<TUser = any>(_err: unknown, user: TUser): TUser {
    return user || (null as TUser);
  }
}
