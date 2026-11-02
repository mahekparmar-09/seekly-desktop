/**
 * generateIco.cjs — Convert assets/icon.png to assets/icon.ico and public/favicon.ico
 */
'use strict';

const fs = require('fs');
const path = require('path');

async function main() {
  const srcPng = path.join(__dirname, '../assets/icon.png');
  const tmp256 = path.join(__dirname, '../assets/_icon256.png');
  const dstIco = path.join(__dirname, '../assets/icon.ico');
  const dstFavico = path.join(__dirname, '../public/favicon.ico');
  const buildDir = path.join(__dirname, '../build');
  const buildIco = path.join(buildDir, 'icon.ico');

  if (!fs.existsSync(srcPng)) {
    console.error('ERROR: assets/icon.png not found.');
    process.exit(1);
  }

  const { Jimp } = require('jimp');

  const img = await Jimp.read(srcPng);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  console.log(`Source image: ${w}x${h}`);

  img.resize({ w: 256, h: 256 });
  await img.write(tmp256);
  console.log('256x256 PNG saved.');

  const { default: pngToIco } = require('png-to-ico');
  const icoBuffer = await pngToIco(tmp256);
  fs.writeFileSync(dstIco, icoBuffer);
  console.log('ICO written to', dstIco, '— bytes:', icoBuffer.length);

  fs.copyFileSync(dstIco, dstFavico);
  console.log('favicon.ico copied to', dstFavico);

  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }
  fs.copyFileSync(dstIco, buildIco);
  console.log('Copied to', buildIco);

  try { fs.unlinkSync(tmp256); } catch {}
  console.log('Done!');
}

main().catch((err) => {
  console.error('Icon generation failed:', err.message);
  process.exit(1);
});
