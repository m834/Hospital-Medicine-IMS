// ============================================================
// M-IMS License Validator  — Standalone (no NestJS DI)
// Runs at application bootstrap BEFORE any module initializes.
// ============================================================

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  LicensePayload,
  MachineFingerprint,
  LicenseStatus,
} from './license.types';

// ─────────────────────────────────────────────
// MASTER KEY  (embedded + obfuscated in build)
// Override via LICENSE_MASTER_KEY env variable.
// ─────────────────────────────────────────────
const _k1 = 'M1MS';
const _k2 = 'H05P1T4L';
const _k3 = 'PR0T3CT3D';
const _k4 = '2026-K3Y';
const EMBEDDED_MASTER_KEY =
  process.env.LICENSE_MASTER_KEY ||
  `${_k1}-${_k2}-${_k3}-${_k4}`;

// Candidate license file locations (searched in order)
const LICENSE_FILE_PATHS: string[] = [
  path.join(process.cwd(), 'license.key'),
  path.join(path.dirname(process.execPath ?? ''), 'license.key'),
  '/etc/mims/license.key',
  path.join(os.homedir(), '.mims', 'license.key'),
];

// Unauthorized-attempt audit log
const AUDIT_LOG_PATH = path.join(process.cwd(), 'license-audit.log');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.scryptSync(masterKey, salt, 32) as Buffer;
}

function auditLog(message: string): void {
  const entry = `[${new Date().toISOString()}] ${message}\n`;
  try {
    fs.appendFileSync(AUDIT_LOG_PATH, entry, 'utf8');
  } catch {
    // best-effort
  }
  console.error(`[LICENSE] ${message}`);
}

// ─────────────────────────────────────────────
// Machine Fingerprint Collection
// ─────────────────────────────────────────────

function getMachineId(): string {
  try {
    if (process.platform === 'linux') {
      const files = ['/etc/machine-id', '/var/lib/dbus/machine-id'];
      for (const f of files) {
        if (fs.existsSync(f)) {
          return fs.readFileSync(f, 'utf8').trim();
        }
      }
    }

    if (process.platform === 'darwin') {
      const raw = execSync(
        "ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformUUID/ { print $3; }'",
        { encoding: 'utf8', timeout: 5000 },
      );
      return raw.trim().replace(/["]/g, '');
    }

    if (process.platform === 'win32') {
      const raw = execSync('wmic csproduct get uuid', {
        encoding: 'utf8',
        timeout: 5000,
      });
      const lines = raw
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.toUpperCase().startsWith('UUID'));
      return lines[0] ?? '';
    }
  } catch {
    // ignore, return empty
  }
  return '';
}

function getMacAddresses(): string[] {
  const ifaces = os.networkInterfaces();
  const macs = new Set<string>();
  for (const iface of Object.values(ifaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') {
        macs.add(addr.mac.toLowerCase());
      }
    }
  }
  return [...macs];
}

export function collectMachineFingerprint(): MachineFingerprint {
  return {
    machineId: getMachineId(),
    macAddresses: getMacAddresses(),
    hostname: os.hostname(),
    platform: process.platform,
  };
}

// ─────────────────────────────────────────────
// Encryption / Decryption
// ─────────────────────────────────────────────

/**
 * Encrypt a license payload.
 *
 * Wire format (hex):
 *   [16 bytes salt][12 bytes IV][16 bytes authTag][N bytes ciphertext]
 */
export function encryptLicense(payload: LicensePayload, masterKey?: string): string {
  const key = masterKey ?? EMBEDDED_MASTER_KEY;
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const derivedKey = deriveKey(key, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  const plaintext = JSON.stringify(payload);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, authTag, ciphertext]).toString('hex');
}

function decryptLicense(hex: string, masterKey?: string): LicensePayload {
  const key = masterKey ?? EMBEDDED_MASTER_KEY;
  const raw = Buffer.from(hex.trim(), 'hex');
  const salt = raw.subarray(0, 16);
  const iv = raw.subarray(16, 28);
  const authTag = raw.subarray(28, 44);
  const ciphertext = raw.subarray(44);

  const derivedKey = deriveKey(key, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);

  const plaintext = decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
  return JSON.parse(plaintext) as LicensePayload;
}

// ─────────────────────────────────────────────
// HMAC Signature
// ─────────────────────────────────────────────

function computeSignature(payload: LicensePayload, masterKey: string): string {
  const { signature: _, ...rest } = payload;
  const data = JSON.stringify(rest, Object.keys(rest).sort());
  return crypto
    .createHmac('sha256', masterKey)
    .update(data)
    .digest('hex');
}

// ─────────────────────────────────────────────
// Core Validation
// ─────────────────────────────────────────────

function findLicenseFile(): string | null {
  for (const p of LICENSE_FILE_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function checkExpiry(expiresAt?: string): boolean {
  if (!expiresAt) return true; // perpetual
  return new Date(expiresAt) > new Date();
}

export function getDaysUntilExpiry(expiresAt?: string): number | null {
  if (!expiresAt) return null; // perpetual
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function machineMatches(
  fingerprint: MachineFingerprint,
  payload: LicensePayload,
): boolean {
  // At least one registered machineId must match current machineId
  const idMatch =
    payload.machineIds.length === 0 ||
    payload.machineIds.includes(fingerprint.machineId);

  // At least one registered MAC must appear in current MAC list
  const currentMacs = new Set(fingerprint.macAddresses);
  const macMatch =
    payload.macAddresses.length === 0 ||
    payload.macAddresses.some((m) => currentMacs.has(m.toLowerCase()));

  return idMatch && macMatch;
}

export interface ValidationResult {
  status: LicenseStatus;
  payload?: LicensePayload;
  message: string;
}

export function validateLicense(): ValidationResult {
  // 1. Locate license file
  const licenseFile = findLicenseFile();
  if (!licenseFile) {
    return {
      status: 'NOT_FOUND',
      message:
        'License file not found. Expected location: ' +
        LICENSE_FILE_PATHS.join(', '),
    };
  }

  // 2. Read & decrypt
  let payload: LicensePayload;
  try {
    const raw = fs.readFileSync(licenseFile, 'utf8');
    payload = decryptLicense(raw);
  } catch {
    return { status: 'CORRUPT', message: 'License file is corrupt or tampered.' };
  }

  // 3. Verify HMAC signature
  const expectedSig = computeSignature(payload, EMBEDDED_MASTER_KEY);
  if (payload.signature && payload.signature !== expectedSig) {
    return { status: 'INVALID_SIGNATURE', message: 'License signature is invalid.' };
  }

  // 4. Check expiry
  if (!checkExpiry(payload.expiresAt)) {
    return {
      status: 'EXPIRED',
      message: `License expired on ${payload.expiresAt}. Contact your vendor to renew.`,
    };
  }

  // 5. Check machine binding
  const fingerprint = collectMachineFingerprint();
  if (!machineMatches(fingerprint, payload)) {
    return {
      status: 'MACHINE_MISMATCH',
      message:
        `This license is bound to a different machine. ` +
        `Current machine-id: "${fingerprint.machineId}", ` +
        `MACs: [${fingerprint.macAddresses.join(', ')}]. ` +
        `Contact your vendor to re-issue the license.`,
    };
  }

  const daysLeft = getDaysUntilExpiry(payload.expiresAt);
  if (daysLeft !== null && daysLeft <= 30) {
    console.warn(
      `⚠️  [LICENSE] License expires in ${daysLeft} day(s) (${payload.expiresAt}). ` +
      `Contact Code Hustlers to renew before it stops working.`,
    );
  }

  return {
    status: 'VALID',
    payload,
    message: `License valid — client: "${payload.clientName}", expires: ${payload.expiresAt ?? 'perpetual'}${daysLeft !== null ? ` (${daysLeft} days remaining)` : ''}`,
  };
}

// ─────────────────────────────────────────────
// Bootstrap Guard — call this at startup
// ─────────────────────────────────────────────

export async function enforeceLicenseOrExit(): Promise<LicensePayload> {
  // ── Development bypass ────────────────────────────────────────────────────
  // Set SKIP_LICENSE_CHECK=true in .env to skip license validation locally.
  // This flag is ONLY honoured when NODE_ENV !== 'production'.
  // ──────────────────────────────────────────────────────────────────────────
  if (
    process.env.SKIP_LICENSE_CHECK === 'true' &&
    process.env.NODE_ENV !== 'production'
  ) {
    console.warn(
      '⚠️  [LICENSE] SKIP_LICENSE_CHECK=true — license validation bypassed (development only).',
    );
    return {} as LicensePayload;
  }

  const result = validateLicense();

  if (result.status !== 'VALID') {
    const host = os.hostname();
    const fingerprint = collectMachineFingerprint();
    auditLog(
      `UNAUTHORIZED START ATTEMPT | status=${result.status} | host=${host} | ` +
        `machine-id="${fingerprint.machineId}" | MACs=[${fingerprint.macAddresses.join(',')}] | ` +
        `message="${result.message}"`,
    );

    console.error('\n╔══════════════════════════════════════════════════╗');
    console.error('║           M-IMS LICENSE VALIDATION FAILED         ║');
    console.error('╠══════════════════════════════════════════════════╣');
    console.error(`║  Status  : ${result.status.padEnd(38)} ║`);
    console.error(`║  Reason  : ${result.message.substring(0, 38).padEnd(38)} ║`);
    console.error('║                                                    ║');
    console.error('║  Contact your vendor to obtain a valid license.    ║');
    console.error('╚══════════════════════════════════════════════════╝\n');

    // Delay to prevent fast brute-force restart loops
    await new Promise((r) => setTimeout(r, 3000));
    process.exit(1);
  }

  console.log(`✅ [LICENSE] ${result.message}`);
  return result.payload!;
}
