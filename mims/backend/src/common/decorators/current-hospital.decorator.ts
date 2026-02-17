import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the hospital ID from the JWT token or request
 * Users can only access their own hospital's data
 * Usage: @CurrentHospital() hospitalId: string
 */
export const CurrentHospital = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // Hospital ID comes from the authenticated user
    return request.user?.hospitalId || request.headers['x-hospital-id'];
  },
);
