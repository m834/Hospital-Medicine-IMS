#!/usr/bin/env ts-node
// ============================================================
// M-IMS License Key Generator
// ============================================================
// Usage:
//   npx ts-node scripts/generate-license.ts \
//     --client-name="City Hospital" \
//     --licensed-to="Dr. Ahmed Al-Rashidi" \
//     --expires="2027-12-31"
//
// OR — auto-detect current machine (useful for pre-binding):
//   npx ts-node scripts/generate-license.ts \
//     --client-name="City Hospital" \
//     --licensed-to="Dr. Ahmed" \
//     --current-machine \
//     --expires="2027-12-31"
//
// OR — supply machine info explicitly:
//   npx ts-node scripts/generate-license.ts \
//     --client-name="City Hospital" \
//     --licensed-to="Dr. Ahmed" \
//     --machine-id="d3b2c1a..." \
//     --mac="aa:bb:cc:dd:ee:ff" \
//     --mac="11:22:33:44:55:66"
//
// Output:
//   license.key  (encrypted license file — ship this to the client)
//   license.info (human-readable summary — keep for your records)
// ============================================================

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

// Re-export the same functions used by the validator to guarantee symmetry
import {
  encryptLicense,
  collectMachineFingerprint,
} from '../src/common/license/license-validator';
import { LicensePayload } from '../src/common/license/license.types';

// ─────────────────────────────────────────────
// Argument Parsing
// ─────────────────────────────────────────────
function parseArgs(): Record<string, string | string[] | boolean> {
  const args = process.argv.slice(2);
  const result: Record<string, string | string[] | boolean> = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      const value = rest.join('=');
      if (value === '' || value === undefined) {
        result[key] = true; // flag
      } else if (key === 'mac') {
        // Support multiple --mac arguments
        const existing = result['mac'];
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          result['mac'] = [value];
        }
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║        M-IMS License Key Generator           ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // Required fields
  const clientName = args['client-name'] as string;
  const licensedTo = args['licensed-to'] as string;
  if (!clientName || !licensedTo) {
    console.error(
      'ERROR: --client-name and --licensed-to are required.\n' +
        'Usage: ts-node scripts/generate-license.ts --client-name="Hospital" --licensed-to="Name" [options]',
    );
    process.exit(1);
  }

  // Machine fingerprint
  let machineIds: string[] = [];
  let macAddresses: string[] = [];

  if (args['current-machine']) {
    const fp = collectMachineFingerprint();
    machineIds = fp.machineId ? [fp.machineId] : [];
    macAddresses = fp.macAddresses;
    console.log('🔍 Auto-detected machine fingerprint:');
    console.log(`   Machine ID : ${fp.machineId || '(not detected)'}`);
    console.log(`   MACs       : ${fp.macAddresses.join(', ') || '(none)'}`);
    console.log(`   Hostname   : ${fp.hostname}`);
    console.log(`   Platform   : ${fp.platform}\n`);
  } else {
    if (args['machine-id']) {
      machineIds = [args['machine-id'] as string];
    }
    const rawMacs = args['mac'];
    if (rawMacs) {
      const macList = Array.isArray(rawMacs)
        ? rawMacs
        : typeof rawMacs === 'string'
        ? [rawMacs]
        : [];
      macAddresses = macList.map((m) => m.toLowerCase());
    }
  }

  if (machineIds.length === 0 && macAddresses.length === 0) {
    console.warn(
      '⚠️  WARNING: No machine binding specified. The license will work on ANY machine.\n' +
        '   Pass --current-machine, --machine-id, or --mac to bind to a specific server.\n',
    );
  }

  // Expiry
  let expiresAt: string | undefined;
  if (args['expires']) {
    const d = new Date(args['expires'] as string);
    if (isNaN(d.getTime())) {
      console.error('ERROR: Invalid --expires date. Use ISO format: YYYY-MM-DD');
      process.exit(1);
    }
    expiresAt = d.toISOString().split('T')[0];
  }

  // Build payload
  const payload: LicensePayload = {
    clientName,
    licensedTo,
    machineIds,
    macAddresses,
    issuedAt: new Date().toISOString().split('T')[0],
    expiresAt,
    version: '1.0',
    features: ['attendance', 'inventory', 'clinical', 'reports'],
  };

  // Compute HMAC signature
  const masterKey =
    process.env.LICENSE_MASTER_KEY ?? 'M1MS-H05P1T4L-PR0T3CT3D-2026-K3Y';
  const { signature: _s, ...payloadWithoutSig } = payload;
  const sigData = JSON.stringify(
    payloadWithoutSig,
    Object.keys(payloadWithoutSig).sort(),
  );
  const signature = crypto
    .createHmac('sha256', masterKey)
    .update(sigData)
    .digest('hex');
  payload.signature = signature;

  // Encrypt
  const encrypted = encryptLicense(payload, masterKey);

  // Write license.key
  const outputDir = path.join(__dirname, '..', 'dist-protected');
  fs.mkdirSync(outputDir, { recursive: true });

  const licenseFilePath = path.join(outputDir, 'license.key');
  fs.writeFileSync(licenseFilePath, encrypted, 'utf8');

  // Write human-readable info (NEVER ship this to client)
  const infoPath = path.join(outputDir, 'license.info');
  const info = [
    '=== M-IMS LICENSE RECORD (VENDOR COPY - DO NOT DISTRIBUTE) ===',
    `Client Name  : ${payload.clientName}`,
    `Licensed To  : ${payload.licensedTo}`,
    `Machine IDs  : ${payload.machineIds.join(', ') || 'ANY'}`,
    `MAC Addresses: ${payload.macAddresses.join(', ') || 'ANY'}`,
    `Issued At    : ${payload.issuedAt}`,
    `Expires At   : ${payload.expiresAt ?? 'Perpetual'}`,
    `Version      : ${payload.version}`,
    `Features     : ${(payload.features ?? []).join(', ')}`,
    `Signature    : ${payload.signature}`,
    `Generated On : ${new Date().toISOString()}`,
    '================================================================',
  ].join('\n');
  fs.writeFileSync(infoPath, info, 'utf8');

  console.log('✅ License generated successfully!\n');
  console.log(`   📄 License file  : ${licenseFilePath}`);
  console.log(`   📋 License info  : ${infoPath}\n`);
  console.log('📦 DEPLOYMENT INSTRUCTIONS:');
  console.log('   1. Copy  license.key  to the client server (next to the app executable).');
  console.log('   2. Keep  license.info  in your vendor records — NEVER send it to the client.');
  console.log('   3. Set environment variable LICENSE_MASTER_KEY on the server.');
  console.log('   4. Start the application. It will validate on boot.\n');
}

main().catch((e) => {
  console.error('License generation failed:', e.message);
  process.exit(1);
});
