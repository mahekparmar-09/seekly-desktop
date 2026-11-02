/**
 * scripts/buildBranding.cjs
 * Renders SVG logos into high-resolution PNGs and Windows ICO formats using @resvg/resvg-js and png-to-ico.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

async function main() {
  const brandingDir = path.join(__dirname, '../assets/branding');
  const iconSvgPath = path.join(brandingDir, 'seekly-icon.svg');
  const logoSvgPath = path.join(brandingDir, 'seekly-logo.svg');

  if (!fs.existsSync(iconSvgPath)) {
    throw new Error(`Missing ${iconSvgPath}`);
  }

  const iconSvg = fs.readFileSync(iconSvgPath, 'utf8');
  const logoSvg = fs.readFileSync(logoSvgPath, 'utf8');

  // 1. Render icon sizes: 512, 256, 128, 64, 48, 32, 16
  const sizes = [512, 256, 128, 64, 48, 32, 16];
  const pngPaths = [];

  for (const size of sizes) {
    const resvg = new Resvg(iconSvg, {
      fitTo: { mode: 'width', value: size }
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    const outPng = path.join(brandingDir, `seekly-icon-${size}.png`);
    fs.writeFileSync(outPng, pngBuffer);
    pngPaths.push(outPng);
    console.log(`Rendered seekly-icon-${size}.png (${pngBuffer.length} bytes)`);
  }

  // 2. Render horizontal logo PNG (width: 760 for 2x crispness)
  const logoResvg = new Resvg(logoSvg, {
    fitTo: { mode: 'width', value: 760 }
  });
  const logoPngBuffer = logoResvg.render().asPng();
  const outLogoPng = path.join(brandingDir, 'seekly-logo.png');
  fs.writeFileSync(outLogoPng, logoPngBuffer);
  console.log(`Rendered seekly-logo.png (${logoPngBuffer.length} bytes)`);

  // 3. Multi-resolution Windows ICO (256, 128, 64, 48, 32, 16)
  const { default: pngToIco } = require('png-to-ico');
  const icoInputs = [
    path.join(brandingDir, 'seekly-icon-256.png'),
    path.join(brandingDir, 'seekly-icon-128.png'),
    path.join(brandingDir, 'seekly-icon-64.png'),
    path.join(brandingDir, 'seekly-icon-48.png'),
    path.join(brandingDir, 'seekly-icon-32.png'),
    path.join(brandingDir, 'seekly-icon-16.png')
  ];

  const icoBuffer = await pngToIco(icoInputs);
  const icoPath = path.join(brandingDir, 'seekly-icon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`Generated seekly-icon.ico (${icoBuffer.length} bytes)`);

  // 4. Distribute to build/ and public/ targets
  const buildDir = path.join(__dirname, '../build');
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  // Update build/ resources
  fs.copyFileSync(icoPath, path.join(buildDir, 'icon.ico'));
  fs.copyFileSync(path.join(brandingDir, 'seekly-icon-256.png'), path.join(buildDir, 'icon.png'));
  console.log('Updated build/icon.ico and build/icon.png');

  // Update public/ for browser and web
  fs.copyFileSync(icoPath, path.join(publicDir, 'favicon.ico'));
  fs.copyFileSync(iconSvgPath, path.join(publicDir, 'favicon.svg'));
  fs.copyFileSync(iconSvgPath, path.join(publicDir, 'seekly-icon.svg'));
  fs.copyFileSync(logoSvgPath, path.join(publicDir, 'seekly-logo.svg'));
  console.log('Updated public/ assets (favicon.ico, favicon.svg, seekly-icon.svg, seekly-logo.svg)');

  console.log('Branding generation completed successfully!');
}

main().catch((err) => {
  console.error('Build branding error:', err);
  process.exit(1);
});
