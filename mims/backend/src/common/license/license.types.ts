// ============================================================
// M-IMS License Types
// ============================================================

export interface LicensePayload {
  /** Registered client/hospital name */
  clientName: string;
  /** Registered license owner full name */
  licensedTo: string;
  /** Allowed machine-id hashes (one or more machines) */
  machineIds: string[];
  /** Allowed MAC addresses (at least one must match) */
  macAddresses: string[];
  /** ISO date when license was issued */
  issuedAt: string;
  /** ISO date when license expires (undefined = perpetual) */
  expiresAt?: string;
  /** License schema version */
  version: string;
  /** Enabled feature flags for this client */
  features?: string[];
  /** HMAC integrity signature */
  signature?: string;
}

export interface MachineFingerprint {
  machineId: string;
  macAddresses: string[];
  hostname: string;
  platform: string;
}

export type LicenseStatus =
  | 'VALID'
  | 'NOT_FOUND'
  | 'CORRUPT'
  | 'MACHINE_MISMATCH'
  | 'EXPIRED'
  | 'INVALID_SIGNATURE';
