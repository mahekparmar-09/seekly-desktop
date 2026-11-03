/**
 * stampIcon.cjs
 *
 * Electron-builder afterPack hook AND standalone script:
 * Uses rcedit to embed the official Seekly icon into Seekly.exe
 * BEFORE electron-builder packages the NSIS installer (Seekly-Setup.exe).
 *
 * This ensures that both the unpacked Seekly.exe AND the distributed installer
 * contain the authentic Seekly icon.
 */

const path = require('path');
const fs = require('fs');

async function stampExecutable(targetDir) {
  const { rcedit } = require('rcedit');

  const exePath = path.resolve(targetDir, 'Seekly.exe');
  const icoPath = path.resolve(__dirname, '../assets/branding/seekly-icon.ico');

  if (!fs.existsSync(exePath)) {
    console.warn(`[stampIcon] Target executable not found at ${exePath} – skipping.`);
    return false;
  }
  if (!fs.existsSync(icoPath)) {
    console.warn(`[stampIcon] Seekly icon not found at ${icoPath} – skipping.`);
    return false;
  }

  console.log(`[stampIcon] Stamping Seekly icon into ${exePath} ...`);
  await rcedit(exePath, {
    icon: icoPath,
    'version-string': {
      FileDescription: 'Seekly Desktop Search',
      ProductName: 'Seekly',
      LegalCopyright: 'Copyright © 2026 Seekly Team. All rights reserved.',
      OriginalFilename: 'Seekly.exe'
    }
  });
  console.log('[stampIcon] ✓ Seekly icon & metadata stamped successfully into executable!');
  return true;
}

// Export for electron-builder afterPack hook
module.exports = async function (context) {
  if (context.electronPlatformName === 'win32') {
    const dir = context.appOutDir;
    await stampExecutable(dir);
  }
};

// Also support running directly via node scripts/stampIcon.cjs
if (require.main === module) {
  const defaultDir = path.resolve(__dirname, '../release/win-unpacked');
  stampExecutable(defaultDir).catch((err) => {
    console.error('[stampIcon] Error stamping executable:', err.message);
    process.exit(1);
  });
}
