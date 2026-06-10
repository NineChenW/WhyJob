// Build script for Explorer Agent Chrome Extension
// Compiles TypeScript to JavaScript for Chrome Extension

import * as esbuild from 'esbuild';
import { writeFileSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

// Ensure dist directory exists
const distDir = join(__dirname, 'dist');
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// Ensure popup subdirectory exists
const popupDir = join(distDir, 'popup');
if (!existsSync(popupDir)) {
  mkdirSync(popupDir, { recursive: true });
}

// Copy static files
const staticFiles = ['manifest.json', 'popup/popup.html'];

for (const file of staticFiles) {
  const src = join(__dirname, file);
  const dest = join(distDir, file);
  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`Copied: ${file}`);
  }
}

// Build configuration
const buildOptions = {
  entryPoints: [
    { in: 'service-worker.ts', out: 'service-worker' },
    { in: 'content-script.ts', out: 'content-script' },
    { in: 'popup/popup.ts', out: 'popup/popup' },
  ],
  bundle: true,
  sourcemap: true,
  format: 'esm',
  target: ['chrome130'],
  outdir: distDir,
  platform: 'browser',
  logLevel: 'info',
};

async function build() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    const result = await esbuild.build(buildOptions);
    console.log('Build complete!');

    // Handle assets - create placeholder icons
    const assetsDir = join(distDir, 'assets');
    if (!existsSync(assetsDir)) {
      mkdirSync(assetsDir, { recursive: true });
    }

    console.log('\nOutput in:', distDir);
    console.log('To load the extension:');
    console.log('1. Open Chrome and go to chrome://extensions/');
    console.log('2. Enable "Developer mode"');
    console.log('3. Click "Load unpacked"');
    console.log('4. Select the "dist" folder');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});