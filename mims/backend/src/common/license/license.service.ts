import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  validateLicense,
  collectMachineFingerprint,
  getDaysUntilExpiry,
} from './license-validator';
import { LicensePayload } from './license.types';

/**
 * LicenseService
 *
 * Performs periodic runtime license re-validation so that:
 *  - Tampering with the license file post-boot is detected.
 *  - Clock rollback attacks on expiry date are mitigated.
 *  - Any anomaly triggers a clean shutdown.
 */
@Injectable()
export class LicenseService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LicenseService.name);
  private cachedPayload: LicensePayload | null = null;

  onApplicationBootstrap() {
    // License was already validated before NestJS bootstrap.
    // Re-read to cache the payload for health/info endpoints.
    const result = validateLicense();
    if (result.status === 'VALID') {
      this.cachedPayload = result.payload ?? null;
      this.logger.log(
        `License active — client: "${this.cachedPayload?.clientName}", ` +
          `expires: ${this.cachedPayload?.expiresAt ?? 'perpetual'}`,
      );
    }
  }

  /** Re-validate every 6 hours. Kills the process on failure. */
  @Cron(CronExpression.EVERY_6_HOURS)
  async periodicReValidation() {
    this.logger.debug('Running periodic license re-validation…');
    const result = validateLicense();
    if (result.status !== 'VALID') {
      this.logger.error(
        `Periodic license check FAILED: ${result.status} — ${result.message}`,
      );
      await new Promise((r) => setTimeout(r, 2000));
      process.exit(1);
    }
    this.logger.debug('Periodic license check passed.');
  }

  getLicenseInfo(): Record<string, unknown> {
    const daysLeft = getDaysUntilExpiry(this.cachedPayload?.expiresAt);
    return {
      clientName: this.cachedPayload?.clientName ?? 'Unknown',
      licensedTo: this.cachedPayload?.licensedTo ?? 'Unknown',
      issuedAt: this.cachedPayload?.issuedAt,
      expiresAt: this.cachedPayload?.expiresAt ?? 'perpetual',
      daysRemaining: daysLeft,
      renewalRequired: daysLeft !== null && daysLeft <= 30,
      features: this.cachedPayload?.features ?? [],
    };
  }

  getMachineInfo(): Record<string, unknown> {
    const fp = collectMachineFingerprint();
    return {
      machineId: fp.machineId,
      macAddresses: fp.macAddresses,
      hostname: fp.hostname,
      platform: fp.platform,
    };
  }
}
