import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the current user from the JWT token
 * Usage: @CurrentUser() user: any
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
