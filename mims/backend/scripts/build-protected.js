#!/usr/bin/env node
// ============================================================
// M-IMS Protected Build Pipeline
// ============================================================
// Steps:
//   1. Clean previous dist
//   2. Compile TypeScript (nest build)
//   3. Obfuscate all .js files in dist/ (javascript-obfuscator)
//   4. Strip source maps from dist/
//   5. Bundle into a single executable (pkg) — optional
//   6. Copy license.key + env template to dist-protected/
// ============================================================

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'dist-protected');

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function run(cmd, opts = {}) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}

function walk(dir, exts = ['.js']) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walk(full, exts));
    } else if (exts.includes(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

function removeSourceMaps(dir) {
  for (const file of walk(dir, ['.map'])) {
    fs.unlinkSync(file);
  }
  // Also strip inline sourceMappingURL comments
  for (const file of walk(dir, ['.js'])) {
    let src = fs.readFileSync(file, 'utf8');
    src = src.replace(/\/\/# sourceMappingURL=.*$/gm, '');
    src = src.replace(/\/\*# sourceMappingURL=.*?\*\//gm, '');
    fs.writeFileSync(file, src, 'utf8');
  }
}

// ─────────────────────────────────────────────
// Step 1: Clean
// ─────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════╗');
console.log('║      M-IMS Protected Build Pipeline          ║');
console.log('╚══════════════════════════════════════════════╝\n');

console.log('📦 Step 1: Cleaning previous builds…');
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
if (fs.existsSync(OUT))  fs.rmSync(OUT,  { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ─────────────────────────────────────────────
// Step 2: TypeScript Compilation
// ─────────────────────────────────────────────
console.log('\n📦 Step 2: Compiling TypeScript…');
run('npx nest build');

// ─────────────────────────────────────────────
// Step 3: Remove source maps from dist
// ─────────────────────────────────────────────
console.log('\n📦 Step 3: Removing source maps…');
removeSourceMaps(DIST);

// ─────────────────────────────────────────────
// Step 4: Obfuscate dist/ → dist-protected/app/
// ─────────────────────────────────────────────
console.log('\n📦 Step 4: Obfuscating JavaScript files…');

const OBFUSCATED_APP = path.join(OUT, 'app');
fs.mkdirSync(OBFUSCATED_APP, { recursive: true });

// Copy non-JS files verbatim (prisma client, assets, etc.)
function copyDirExceptJs(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirExceptJs(srcPath, destPath);
    } else if (path.extname(entry.name) !== '.js') {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
copyDirExceptJs(DIST, OBFUSCATED_APP);

// Obfuscate each .js file
const obfuscatorConfig = require('../obfuscator.config');
let obfuscated = 0, skipped = 0;

// Paths to SKIP obfuscation (Prisma generated code is delicate)
const SKIP_PATTERNS = [
  path.join('node_modules'),
  // Prisma runtime is already pre-compiled native code – skip if copied
];

function shouldSkip(filePath) {
  return SKIP_PATTERNS.some((p) => filePath.includes(p));
}

const JavaScriptObfuscator = (() => {
  try {
    return require('javascript-obfuscator');
  } catch {
    console.error(
      '\n❌ javascript-obfuscator not found.\n' +
        '   Run: npm install --save-dev javascript-obfuscator\n',
    );
    process.exit(1);
  }
})();

for (const jsFile of walk(DIST, ['.js'])) {
  const rel  = path.relative(DIST, jsFile);
  const dest = path.join(OBFUSCATED_APP, rel);

  if (shouldSkip(jsFile)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(jsFile, dest);
    skipped++;
    continue;
  }

  const source = fs.readFileSync(jsFile, 'utf8');
  try {
    const result = JavaScriptObfuscator.obfuscate(source, {
      ...obfuscatorConfig,
      inputFileName: rel,
    });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, result.getObfuscatedCode(), 'utf8');
    obfuscated++;
  } catch (err) {
    // Fallback: copy as-is if obfuscation fails (e.g. complex generated code)
    console.warn(`⚠️  Skipping obfuscation for ${rel}: ${err.message}`);
    fs.copyFileSync(jsFile, dest);
    skipped++;
  }

  if ((obfuscated + skipped) % 20 === 0) {
    process.stdout.write(`   ✓ ${obfuscated + skipped} files processed…\r`);
  }
}

console.log(`\n   ✅ Obfuscated: ${obfuscated} files | Copied as-is: ${skipped} files`);

// ─────────────────────────────────────────────
// Step 5: Copy Prisma client & schema
// ─────────────────────────────────────────────
console.log('\n📦 Step 5: Copying Prisma client…');
const prismaClientSrc = path.join(ROOT, 'node_modules', '.prisma');
const prismaClientDest = path.join(OUT, 'node_modules', '.prisma');
if (fs.existsSync(prismaClientSrc)) {
  fs.mkdirSync(path.dirname(prismaClientDest), { recursive: true });
  run(`cp -r "${prismaClientSrc}" "${prismaClientDest}"`);
}
// Copy @prisma/client
const prismaRuntimeSrc = path.join(ROOT, 'node_modules', '@prisma', 'client');
const prismaRuntimeDest = path.join(OUT, 'node_modules', '@prisma', 'client');
if (fs.existsSync(prismaRuntimeSrc)) {
  fs.mkdirSync(path.dirname(prismaRuntimeDest), { recursive: true });
  run(`cp -r "${prismaRuntimeSrc}" "${prismaRuntimeDest}"`);
}

// Copy prisma schema (needed for migration at runtime)
const schemaSrc = path.join(ROOT, 'prisma', 'schema.prisma');
const schemaDest = path.join(OUT, 'prisma', 'schema.prisma');
fs.mkdirSync(path.dirname(schemaDest), { recursive: true });
fs.copyFileSync(schemaSrc, schemaDest);

// ─────────────────────────────────────────────
// Step 6: Create production package.json (no devDeps)
// ─────────────────────────────────────────────
console.log('\n📦 Step 6: Creating production package.json…');
const originalPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const prodPkg = {
  name: originalPkg.name,
  version: originalPkg.version,
  description: originalPkg.description,
  private: true,
  engines: originalPkg.engines,
  scripts: {
    start: 'node app/main.js',
  },
  dependencies: originalPkg.dependencies,
};
fs.writeFileSync(
  path.join(OUT, 'package.json'),
  JSON.stringify(prodPkg, null, 2),
  'utf8',
);

// ─────────────────────────────────────────────
// Step 7: Write startup wrapper script
// ─────────────────────────────────────────────
console.log('\n📦 Step 7: Writing startup wrapper…');
const startScript = `#!/bin/bash
# M-IMS Backend — Production Startup
# =====================================
# Prerequisites:
#   - license.key must be in the same directory as this script
#   - .env file must be configured
#   - PostgreSQL and Redis must be running
# =====================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Validate license file
if [ ! -f "license.key" ]; then
  echo "❌ ERROR: license.key not found. Cannot start application."
  exit 1
fi

# Run database migrations
echo "🔄 Running database migrations…"
npx prisma migrate deploy --schema=./prisma/schema.prisma 2>/dev/null || true

# Start the application
echo "🚀 Starting M-IMS Backend…"
exec node app/main.js
`;
fs.writeFileSync(path.join(OUT, 'start.sh'), startScript, 'utf8');
fs.chmodSync(path.join(OUT, 'start.sh'), 0o755);

// ─────────────────────────────────────────────
// Step 8: Copy app/main.js → main.js (Windows compat)
// ─────────────────────────────────────────────
console.log('\n📦 Step 8: Copying app/main.js → main.js (Windows compatibility)…');
const appMain = path.join(OUT, 'app', 'main.js');
const rootMain = path.join(OUT, 'main.js');
if (fs.existsSync(appMain)) {
  fs.copyFileSync(appMain, rootMain);
  console.log('   ✅ dist-protected/main.js ready for direct deployment');
}

// ─────────────────────────────────────────────
// Done
// ─────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════╗');
console.log('║       ✅ Protected Build Complete!            ║');
console.log('╚══════════════════════════════════════════════╝');
console.log(`\n📁 Output directory: ${OUT}`);
console.log('\n📋 DEPLOYMENT CHECKLIST:');
console.log('   ✅ JavaScript source obfuscated');
console.log('   ✅ Source maps removed');
console.log('   ✅ Production package.json generated');
console.log('   ✅ Startup script created (start.sh)');
console.log('\n⚠️  BEFORE SHIPPING TO CLIENT:');
console.log('   1. Run: npx ts-node scripts/generate-license.ts to create license.key');
console.log('   2. Copy license.key into dist-protected/');
console.log('   3. Configure dist-protected/.env with client database credentials');
console.log('   4. Run: npm install --production in dist-protected/ to install runtime deps');
console.log('   5. DO NOT ship: src/, scripts/, tsconfig.json, *.ts files\n');
