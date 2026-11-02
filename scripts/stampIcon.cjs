/**
 * stampIcon.cjs
 * Post-build script: uses rcedit to embed the Seekly icon directly
 * into the packaged Seekly.exe after electron-builder finishes.
 *
 * Run automatically via: npm run dist
 */

const path = require('path');
const fs = require('fs');

async function main() {
  const { rcedit } = require('rcedit');

  const exePath = path.resolve(__dirname, '../release/win-unpacked/Seekly.exe');
  const icoPath = path.resolve(__dirname, '../assets/branding/seekly-icon.ico');

  if (!fs.existsSync(exePath)) {
    console.warn('[stampIcon] Seekly.exe not found – skipping icon stamp.');
    return;
  }
  if (!fs.existsSync(icoPath)) {
    console.warn('[stampIcon] seekly-icon.ico not found – skipping icon stamp.');
    return;
  }

  console.log('[stampIcon] Stamping icon into Seekly.exe …');
  await rcedit(exePath, { icon: icoPath });
  console.log('[stampIcon] ✓ Icon stamped successfully.');
}

main().catch(err => {
  console.error('[stampIcon] Failed:', err.message);
  process.exit(1);
});

