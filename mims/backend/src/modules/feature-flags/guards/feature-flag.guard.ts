import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from '../feature-flags.service';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagKey = this.reflector.get<string>(FEATURE_FLAG_KEY, context.getHandler());

    if (!flagKey) {
      // No feature flag required, allow access
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const hospitalId = request.user?.hospitalId; // Assumes JWT payload has hospitalId

    const enabled = await this.featureFlagsService.isEnabled(flagKey, hospitalId);

    if (!enabled) {
      throw new ForbiddenException(`Feature '${flagKey}' is not enabled for this hospital`);
    }

    return true;
  }
}
