#!/usr/bin/env ts-node

/**
 * SVG to GreenShape Converter
 *
 * Usage: Copy this script output and paste into courses.ts
 *
 * This script:
 * 1. Takes raw SVG code
 * 2. Extracts the path data
 * 3. Translates it to center at (50, 50) - NO SCALING!
 * 4. Outputs the greenShape object ready to paste
 */

import { GreenShapeImporter } from '../lib/greenShapeImporter';

// PASTE YOUR SVG HERE (replace the example below)
const rawSVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="338" height="400" viewBox="0 0 338 400" fill="none">
  <path d="M159.06 381.927C109.363 419.299 56.2193 383.165 36.5595 373.927C36.5595 373.927 11.5678 343.427 4.56854 308.427C1.6781 293.973 -3.54888 258.53 9.06836 221.914C36.5595 165.914 42.0501 187.427 65.5595 115.427C89.0689 43.427 170.05 14.427 187.06 9.92698C204.069 5.42698 251.05 -11.0678 296.06 16.927C331.428 43.8073 333.553 76.6569 336.03 114.97L336.06 115.427C328.069 194.914 271.069 171.414 248.569 235.914C237.192 268.528 218.569 275.414 206.069 310.914C193.569 346.414 174.987 369.95 159.06 381.927Z" stroke="black" stroke-width="2"/>
</svg>
`;

// Optional: Add real-world dimensions (in meters)
// Set to null if you don't have measurements yet
const realWorldDimensions = {
  width: 28,  // meters - REPLACE WITH ACTUAL
  height: 32, // meters - REPLACE WITH ACTUAL
  captureElevation: 350
};

function extractSVGPath(svgContent: string): string {
  const pathMatch = svgContent.match(/<path[^>]*\sd="([^"]+)"/);
  if (!pathMatch) {
    throw new Error('No path found in SVG');
  }
  return pathMatch[1];
}

function extractViewBox(svgContent: string): { width: number; height: number } | null {
  const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) return null;

  const values = viewBoxMatch[1].split(/\s+/).map(parseFloat);
  return { width: values[2], height: values[3] };
}

function main() {
  try {
    console.log('🔍 Extracting SVG path...\n');

    const pathData = extractSVGPath(rawSVG);
    const viewBox = extractViewBox(rawSVG);

    if (viewBox) {
      console.log(`📐 Original viewBox: ${viewBox.width} x ${viewBox.height}`);
    }

    console.log('🔄 Translating to center at (50, 50) - NO SCALING!\n');

    // Import using GreenShapeImporter (translate only, no scaling!)
    const greenShape = GreenShapeImporter.fromSVG(
      pathData,
      realWorldDimensions || undefined
    );

    console.log('✅ Conversion complete!\n');
    console.log('📋 Copy and paste this into your courses.ts:\n');
    console.log('greenShape: ' + JSON.stringify(greenShape, null, 2));
    console.log('\n');

    // Also show just the path for quick reference
    console.log('📍 SVG Path only (for manual editing):');
    console.log(greenShape.svgPath);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
