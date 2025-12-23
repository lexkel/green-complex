#!/usr/bin/env node

/**
 * SVG to GreenShape Converter - BATCH MODE
 *
 * Add all your SVGs to the array below and run: node scripts/convert-svg.mjs
 * The script will process all holes and output the greenShape objects
 */

// ============ PASTE YOUR SVGs HERE ============
// Add as many holes as you want - each entry should have holeNumber and rawSVG

const svgData = [
  {
    holeNumber: 1,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="338" height="400" viewBox="0 0 338 400" fill="none">
        <path d="M159.06 381.927C109.363 419.299 56.2193 383.165 36.5595 373.927C36.5595 373.927 11.5678 343.427 4.56854 308.427C1.6781 293.973 -3.54888 258.53 9.06836 221.914C36.5595 165.914 42.0501 187.427 65.5595 115.427C89.0689 43.427 170.05 14.427 187.06 9.92698C204.069 5.42698 251.05 -11.0678 296.06 16.927C331.428 43.8073 333.553 76.6569 336.03 114.97L336.06 115.427C328.069 194.914 271.069 171.414 248.569 235.914C237.192 268.528 218.569 275.414 206.069 310.914C193.569 346.414 174.987 369.95 159.06 381.927Z" stroke="black" stroke-width="2"/>
      </svg>`,
    realWorldDimensions: null // or { width: 28, height: 32, captureElevation: 350 }
  },
  {
    holeNumber: 2,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="339" height="294" viewBox="0 0 339 294" fill="none">
        <path d="M40.7178 211.559C62.7242 235.552 101.218 226.559 131.218 237.559C161.218 248.559 167.218 268.059 219.718 286.059C272.218 304.059 318.703 285.572 331.711 242.065C344.718 198.559 335.218 174.059 313.211 140.065C291.203 106.072 260.718 82.5586 215.211 75.5652C169.704 68.5718 179.211 68.5652 149.211 50.0652C119.211 31.5652 118.711 -4.4348 74.2106 1.0652C29.7106 6.5652 18.2171 15.0586 4.21708 79.5586C-9.78292 144.059 18.7114 187.565 40.7178 211.559Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  },
  {
    holeNumber: 3,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="270" height="361" viewBox="0 0 270 361" fill="none">
        <path d="M27.5838 280.968C39.31 333.537 69.9023 358.307 81.7627 359.059C189.667 365.899 161.688 326.959 192.438 278.103C193.932 275.729 195.34 273.268 196.54 270.732C207.433 247.699 219.255 230.204 228.263 214.559C239.881 194.38 260.628 186.644 268.857 114.334C269.514 108.557 269.018 102.676 267.435 97.0823C256.685 59.0795 241.225 22.9498 186.762 8.0539C128.261 -7.94651 122.263 1.0539 76.2627 39.0539C37.2761 71.2602 14.8101 121.424 8.86582 135.972C7.75782 138.684 7.00908 141.507 6.51746 144.395C-0.547063 185.891 -5.04748 222.534 14.6412 252.488C20.4039 261.256 25.2996 270.728 27.5838 280.968Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  },
  {
    holeNumber: 4,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="268" height="332" viewBox="0 0 268 332" fill="none">
        <path d="M252.986 237.224C269.486 205.724 270.486 130.724 258.486 98.2241L258.34 97.8302C246.449 65.6224 241.82 53.0861 198.994 24.2035C155.994 -4.79649 142.986 -1.79042 105.986 5.22408C68.9856 12.2386 58.4856 25.2066 32.4856 50.2241C6.48564 75.2416 -9.00625 135.224 6.99375 158.707C22.9937 182.189 47.9941 209.207 58.4856 237.224C68.9771 265.242 77.4856 337.14 142.986 330.224C208.486 323.308 236.486 268.724 252.986 237.224Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  },
  {
    holeNumber: 5,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="245" height="359" viewBox="0 0 245 359" fill="none">
        <path d="M9.83108 261.091C34.3311 318.091 42.8233 369.091 129.823 356.591C216.823 344.091 235.823 285.091 241.323 261.091C246.823 237.091 243.323 211.589 232.323 175.591C221.323 139.594 241.323 105.591 221.323 48.5914C201.323 -8.40857 129.829 1.09418 129.829 1.09418C129.829 1.09418 17.3234 26.0914 30.329 85.5938C43.3346 145.096 16.8234 175.591 16.8234 175.591C16.8234 175.591 -14.6689 204.091 9.83108 261.091Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  },
  {
    holeNumber: 6,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="320" height="254" viewBox="0 0 320 254" fill="none">
        <path d="M161.296 251.125C108.827 237.655 -5.763 205.124 0.767809 100.656C7.29862 -3.81169 140.832 -3.3664 198.329 2.64536C255.825 8.65711 327.293 76.6363 317.796 148.125C308.299 219.613 213.766 264.594 161.296 251.125Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  },
  {
    holeNumber: 7,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="287" height="327" viewBox="0 0 287 327" fill="none">
        <path d="M130.725 14.8518C104.229 7.35817 36.7246 -19.6499 12.2271 28.344C-12.2705 76.338 6.22926 93.8351 25.7282 117.829C45.2271 141.822 70.2282 144.329 77.2283 158.829C84.2283 173.329 68.2282 199.329 97.2282 269.329C126.228 339.329 171.729 326.335 196.228 322.329C220.728 318.322 268.221 266.368 273.225 227.352C278.228 188.335 295.724 137.345 277.725 84.8516C270.392 63.4676 249.218 35.9945 223.728 25.8287C186.645 11.0395 157.221 22.3454 130.725 14.8518Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  },
  {
    holeNumber: 8,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="284" height="354" viewBox="0 0 284 354" fill="none">
        <path d="M121.181 352.555C34.6816 352.055 -5.31855 265.067 1.18145 177.067C7.68145 89.0672 82.1908 -2.42817 162.186 0.571829C242.181 3.57183 286.176 103.051 282.682 185.051C279.187 267.051 207.681 353.055 121.181 352.555Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  },
  {
    holeNumber: 9,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="245" height="357" viewBox="0 0 245 357" fill="none">
        <path d="M0.517751 99.8251C2.01812 167.325 0.516411 265.815 51.5164 321.815C78.7734 351.745 158.015 395.815 208.015 281.815L208.406 280.923C239.651 209.687 246.493 194.086 242.515 115.843C238.52 37.2734 176.022 10.7963 134.52 1.77347C93.0174 -7.24937 -0.982617 32.3251 0.517751 99.8251Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  },
  {
    holeNumber: 10,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="267" height="290" viewBox="0 0 267 290" fill="none">
        <path d="M13.5038 107.523C-15.4947 66.0234 8.49971 29.5004 41.4997 10.5086C74.4997 -8.48316 109.5 3.51667 145.5 14.0167C181.5 24.5167 193.5 63.5168 206 78.0086C218.5 92.5003 247.723 114.241 262.999 166.509C278.275 218.777 240 260.509 204.504 276.523C169.008 292.538 146.504 292.523 105.004 279.523C63.5039 266.523 44.4997 203.009 39.5038 183.523C34.5079 164.038 42.5024 149.023 13.5038 107.523Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  },
  {
    holeNumber: 11,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="186" height="301" viewBox="0 0 186 301" fill="none">
        <path d="M28.2448 44.8987C15.2448 83.8948 -33.7552 131.899 41.2448 235.399C116.245 338.899 160.245 302.399 183.245 239.399C190.291 220.097 175.381 192.533 180.745 158.398C186.245 123.398 188.94 97.9611 166.745 44.8987C134.745 -31.6013 41.2448 5.90265 28.2448 44.8987Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  },
  {
    holeNumber: 12,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="327" height="260" viewBox="0 0 327 260" fill="none">
        <path d="M297.044 215.605C217.044 299.605 171.046 247.895 65.544 180.107C-39.9578 112.318 -9.9547 -5.74241 104.045 0.757588C218.045 7.25759 267.047 58.6764 267.047 58.6764C267.047 58.6764 377.044 131.605 297.044 215.605Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  },
  {
    holeNumber: 13,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="193" height="249" viewBox="0 0 193 249" fill="none">
        <path d="M140.885 200.993C70.3844 281.493 35.3845 245.493 13.3845 189.493C-8.61548 133.493 -2.11585 37.9789 30.3837 14.4785C62.8833 -9.02183 141.383 -3.02344 168.883 33.4766C196.383 69.9766 211.385 120.493 140.885 200.993Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  },
  {
    holeNumber: 14,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="270" height="306" viewBox="0 0 270 306" fill="none">
        <path d="M203.305 265.164C140.305 324.164 67.8054 321.164 17.8054 237.664C-32.1946 154.164 39.8057 42.6367 62.3056 27.6372C84.8055 12.6377 199.806 -40.3359 245.305 61.6641C290.805 163.664 266.304 206.164 203.305 265.164Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  },
  {
    holeNumber: 15,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="260" height="286" viewBox="0 0 260 286" fill="none">
        <path d="M45.5244 43.5815C-27.9756 120.572 4.02445 224.082 33.0246 247.59C62.0247 271.099 166.524 320.582 224.024 241.582C281.524 162.582 260.024 77.5817 216.524 43.5817L215.773 42.9941C172.403 9.09108 118.602 -32.9658 45.5244 43.5815Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  },
  {
    holeNumber: 16,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="221" height="306" viewBox="0 0 221 306" fill="none">
        <path d="M29.2638 45.8478C13.7644 86.8265 -12.2365 164.873 7.7656 244.848C27.7677 324.822 145.766 316.848 175.266 266.848C204.765 216.848 244.764 132.822 200.765 49.8221C156.766 -33.1779 44.7632 4.86909 29.2638 45.8478Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  },
  {
    holeNumber: 17,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="309" height="341" viewBox="0 0 309 341" fill="none">
        <path d="M58.5223 20.9721C-21.0135 49.6738 -17.2358 219.331 60.3767 289.574C139.379 361.074 212.875 355.074 266.375 278.074C319.875 201.074 325.875 68.0732 261.378 23.0955C197.686 -21.3219 188.107 12.2155 67.4929 19.3118C64.4762 19.4893 61.3648 19.9464 58.5223 20.9721Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  },
  {
    holeNumber: 18,
    rawSVG: `
      <svg xmlns="http://www.w3.org/2000/svg" width="314" height="446" viewBox="0 0 314 446" fill="none">
        <path d="M114.482 444.814C61.5955 441.876 -12.3938 371.316 2.42354 321.906C3.04715 319.827 4.06189 317.829 5.13667 315.942C52.7199 232.435 19.5651 193.824 26.9786 150.814C44.9905 91.0537 82.3215 46.4152 111.482 21.3359C168.082 -27.3425 281.982 17.322 305.982 72.8179C329.982 128.314 284.482 154.815 284.482 208.315C293.482 292.315 262.954 304.372 244.482 337.815C203.002 412.914 139.191 446.187 114.482 444.814Z" stroke="black"/>
      </svg>`,
    realWorldDimensions: null
  }
  
];

// SCALE FACTOR: Apply consistent scaling to all greens
// This maintains the same pixel-to-meter ratio across all greens
const SCALE_FACTOR = 0.5;

// ============ CONVERSION LOGIC ============

function extractSVGPath(svgContent) {
  const pathMatch = svgContent.match(/<path[^>]*\sd="([^"]+)"/);
  if (!pathMatch) throw new Error('No path found in SVG');
  return pathMatch[1];
}

function extractPointsFromPath(svgPath) {
  const points = [];
  let currentX = 0;
  let currentY = 0;

  const cleanPath = svgPath.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  const commandPattern = /([MmLlHhVvCcSsQqTtAaZz])\s*([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let match;

  while ((match = commandPattern.exec(cleanPath)) !== null) {
    const command = match[1];
    const argsString = match[2].trim();
    const args = argsString ? argsString.split(/\s+/).map(parseFloat) : [];

    switch (command) {
      case 'M':
        currentX = args[0]; currentY = args[1];
        points.push([currentX, currentY]);
        break;
      case 'm':
        currentX += args[0]; currentY += args[1];
        points.push([currentX, currentY]);
        break;
      case 'L':
        for (let i = 0; i < args.length; i += 2) {
          currentX = args[i]; currentY = args[i + 1];
          points.push([currentX, currentY]);
        }
        break;
      case 'l':
        for (let i = 0; i < args.length; i += 2) {
          currentX += args[i]; currentY += args[i + 1];
          points.push([currentX, currentY]);
        }
        break;
      case 'C':
        for (let i = 0; i < args.length; i += 6) {
          points.push([args[i], args[i + 1]]);
          points.push([args[i + 2], args[i + 3]]);
          currentX = args[i + 4]; currentY = args[i + 5];
          points.push([currentX, currentY]);
        }
        break;
      case 'c':
        for (let i = 0; i < args.length; i += 6) {
          points.push([currentX + args[i], currentY + args[i + 1]]);
          points.push([currentX + args[i + 2], currentY + args[i + 3]]);
          currentX += args[i + 4]; currentY += args[i + 5];
          points.push([currentX, currentY]);
        }
        break;
      case 'Z':
      case 'z':
        break;
    }
  }

  return points;
}

function calculateCentroid(points) {
  if (points.length === 0) return { x: 50, y: 50 };
  const avgX = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const avgY = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  return { x: avgX, y: avgY };
}

function translatePath(svgPath, tx, ty, scaleFactor) {
  const cleanPath = svgPath.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  let result = '';
  let currentX = 0;
  let currentY = 0;

  const commandPattern = /([MmLlHhVvCcSsQqTtAaZz])\s*([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let match;

  // Helper function to scale and translate absolute coordinates
  const scaleAndTranslate = (x, y) => {
    const scaledX = x * scaleFactor;
    const scaledY = y * scaleFactor;
    return [scaledX + tx, scaledY + ty];
  };

  // Helper function to scale relative coordinates (no translation)
  const scaleRelative = (dx, dy) => {
    return [dx * scaleFactor, dy * scaleFactor];
  };

  while ((match = commandPattern.exec(cleanPath)) !== null) {
    const command = match[1];
    const argsString = match[2].trim();
    const args = argsString ? argsString.split(/\s+/).map(parseFloat) : [];

    result += command;

    switch (command) {
      case 'M':
        [currentX, currentY] = scaleAndTranslate(args[0], args[1]);
        result += ` ${currentX},${currentY}`;
        break;
      case 'm':
        {
          const [dx, dy] = scaleRelative(args[0], args[1]);
          currentX += dx;
          currentY += dy;
          result += ` ${dx},${dy}`;
        }
        break;
      case 'L':
        for (let i = 0; i < args.length; i += 2) {
          [currentX, currentY] = scaleAndTranslate(args[i], args[i + 1]);
          result += ` ${currentX},${currentY}`;
        }
        break;
      case 'l':
        for (let i = 0; i < args.length; i += 2) {
          const [dx, dy] = scaleRelative(args[i], args[i + 1]);
          currentX += dx;
          currentY += dy;
          result += ` ${dx},${dy}`;
        }
        break;
      case 'C':
        for (let i = 0; i < args.length; i += 6) {
          const [x1, y1] = scaleAndTranslate(args[i], args[i + 1]);
          const [x2, y2] = scaleAndTranslate(args[i + 2], args[i + 3]);
          [currentX, currentY] = scaleAndTranslate(args[i + 4], args[i + 5]);
          result += ` ${x1},${y1}`;
          result += ` ${x2},${y2}`;
          result += ` ${currentX},${currentY}`;
        }
        break;
      case 'c':
        for (let i = 0; i < args.length; i += 6) {
          const [dx1, dy1] = scaleRelative(args[i], args[i + 1]);
          const [dx2, dy2] = scaleRelative(args[i + 2], args[i + 3]);
          const [dx3, dy3] = scaleRelative(args[i + 4], args[i + 5]);
          currentX += dx3;
          currentY += dy3;
          result += ` ${dx1},${dy1}`;
          result += ` ${dx2},${dy2}`;
          result += ` ${dx3},${dy3}`;
        }
        break;
      case 'Z':
      case 'z':
        break;
    }

    result += ' ';
  }

  return result.trim();
}

function calculateBounds(points) {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  let minX = points[0][0], minY = points[0][1];
  let maxX = points[0][0], maxY = points[0][1];

  points.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });

  return { minX, minY, maxX, maxY };
}

function processHole(holeNumber, rawSVG, realWorldDimensions) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏌️  Processing Hole ${holeNumber}`);
    console.log('='.repeat(60));

    const pathData = extractSVGPath(rawSVG);
    const points = extractPointsFromPath(pathData);
    const centroid = calculateCentroid(points);

    console.log(`📐 Original centroid: (${centroid.x.toFixed(2)}, ${centroid.y.toFixed(2)})`);
    console.log(`🔄 Scaling by ${SCALE_FACTOR}x and translating to center at (50, 50)`);

    // First scale all points around the origin (0,0)
    const scaledPoints = points.map(([x, y]) => [
      x * SCALE_FACTOR,
      y * SCALE_FACTOR
    ]);

    // Calculate new centroid after scaling
    const scaledCentroid = calculateCentroid(scaledPoints);
    console.log(`📐 Scaled centroid: (${scaledCentroid.x.toFixed(2)}, ${scaledCentroid.y.toFixed(2)})`);

    // Then translate to center at (50, 50)
    const tx = 50 - scaledCentroid.x;
    const ty = 50 - scaledCentroid.y;
    console.log(`📐 Translation: (${tx.toFixed(2)}, ${ty.toFixed(2)})`);

    const translatedPath = translatePath(pathData, tx, ty, SCALE_FACTOR);
    const translatedPoints = scaledPoints.map(([x, y]) => [x + tx, y + ty]);
    const bounds = calculateBounds(translatedPoints);

    const greenShape = {
      type: 'svg',
      svgPath: translatedPath,
      bounds: bounds,
      ...(realWorldDimensions && { realWorldDimensions })
    };

    console.log('\n✅ Conversion complete!');
    console.log(`\n📋 Hole ${holeNumber} greenShape:\n`);

    // Format output with offsetX and offsetY included
    const greenShapeStr = JSON.stringify(greenShape, null, 2);
    const withOffset = greenShapeStr.replace(
      /"bounds": {/,
      `"bounds": {\n        "minX": ${bounds.minX},\n        "minY": ${bounds.minY},\n        "maxX": ${bounds.maxX},\n        "maxY": ${bounds.maxY}\n      },\n      "offsetX": 0,  // Adjust if needed\n      "offsetY": 0,  // Adjust if needed\n      "bounds_orig": {`
    ).replace(/"bounds_orig":/, '"bounds":').replace(/,\n      "bounds": {[^}]+}/s, '');

    console.log(`    {
      number: ${holeNumber},
      par: X, // UPDATE THIS
      distance: XXX, // UPDATE THIS
      greenShape: {
        type: 'svg',
        svgPath: '${greenShape.svgPath}',
        bounds: ${JSON.stringify(bounds)},
        offsetX: 0,  // Adjust if needed
        offsetY: 0   // Adjust if needed
      }
    },`);

    return { holeNumber, greenShape };

  } catch (error) {
    console.error(`\n❌ Error processing Hole ${holeNumber}:`, error.message);
    return null;
  }
}

function main() {
  console.log('🏌️  SVG to GreenShape Converter - BATCH MODE');
  console.log(`\n📦 Processing ${svgData.length} hole(s)...\n`);

  const results = [];

  for (const { holeNumber, rawSVG, realWorldDimensions } of svgData) {
    const result = processHole(holeNumber, rawSVG, realWorldDimensions);
    if (result) {
      results.push(result);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Completed! Processed ${results.length} hole(s)`);
  console.log('='.repeat(60));
  console.log('\n📋 Copy all the greenShape objects above into your courses.ts');
  console.log('   Remember to update the par and distance values!\n');
}

main();
