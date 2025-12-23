import { GreenShape } from '@/data/courses';

/**
 * Green Shape Importer
 *
 * CRITICAL: This class only translates shapes to center at (50,50)
 * NO SCALING is performed! All greens must be captured at the same elevation (350m)
 * to maintain consistent pixel-to-meter ratio across all greens.
 */
export class GreenShapeImporter {
  /**
   * Import green shape from SVG path string
   * CRITICAL: Only translates to center at (50,50) - NO SCALING!
   */
  static fromSVG(
    svgPathString: string,
    realWorldDimensions?: { width: number; height: number; captureElevation?: number }
  ): GreenShape {
    // Parse all coordinates from the SVG path
    const points = this.extractPointsFromPath(svgPathString);

    if (points.length === 0) {
      throw new Error('No points found in SVG path');
    }

    // Calculate centroid (average position)
    const centroid = this.calculateCentroid(points);

    // Calculate translation to center at (50, 50)
    const tx = 50 - centroid.x;
    const ty = 50 - centroid.y;

    // Apply translation to path (NO SCALING!)
    const translatedPath = this.translatePath(svgPathString, tx, ty);

    // Calculate bounds from translated points
    const translatedPoints = points.map(([x, y]) => [x + tx, y + ty] as [number, number]);
    const bounds = this.calculateBoundsFromPoints(translatedPoints);

    return {
      type: 'svg',
      svgPath: translatedPath,
      bounds,
      realWorldDimensions,
    };
  }

  /**
   * Import green shape from GeoJSON polygon coordinates
   * CRITICAL: Only translates to center at (50,50) - NO SCALING!
   */
  static fromGeoJSON(
    geoJsonPolygon: any,
    realWorldDimensions?: { width: number; height: number; captureElevation?: number }
  ): GreenShape {
    // Extract coordinates from GeoJSON
    // GeoJSON format: { type: "Feature", geometry: { type: "Polygon", coordinates: [[[x,y], ...]] } }
    const coordinates = geoJsonPolygon?.geometry?.coordinates?.[0] || geoJsonPolygon?.coordinates?.[0] || geoJsonPolygon;

    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      throw new Error('Invalid GeoJSON polygon format');
    }

    // Convert to [x, y] tuples
    const points: Array<[number, number]> = coordinates.map((coord: any) => {
      if (Array.isArray(coord)) {
        return [coord[0], coord[1]] as [number, number];
      }
      throw new Error('Invalid coordinate format');
    });

    // Calculate centroid
    const centroid = this.calculateCentroid(points);

    // Calculate translation to center at (50, 50)
    const tx = 50 - centroid.x;
    const ty = 50 - centroid.y;

    // Apply translation to all points (NO SCALING!)
    const translatedPoints = points.map(([x, y]) => [x + tx, y + ty] as [number, number]);

    // Convert to SVG path
    const svgPath = this.polygonToPath(translatedPoints);

    // Calculate bounds
    const bounds = this.calculateBoundsFromPoints(translatedPoints);

    return {
      type: 'polygon',
      polygon: translatedPoints,
      svgPath,
      bounds,
      realWorldDimensions,
    };
  }

  /**
   * Convert polygon coordinates to SVG path string
   */
  static polygonToPath(polygon: Array<[number, number]>): string {
    if (polygon.length === 0) return '';

    const first = polygon[0];
    const moves = polygon.slice(1).map(([x, y]) => `L ${x},${y}`).join(' ');

    return `M ${first[0]},${first[1]} ${moves} Z`;
  }

  /**
   * Calculate centroid (center point) of polygon points
   */
  static calculateCentroid(points: Array<[number, number]>): { x: number; y: number } {
    if (points.length === 0) {
      return { x: 50, y: 50 };
    }

    const avgX = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const avgY = points.reduce((sum, p) => sum + p[1], 0) / points.length;

    return { x: avgX, y: avgY };
  }

  /**
   * Extract all coordinate points from an SVG path string
   * Handles M, L, H, V, C, S, Q, T, A commands (both absolute and relative)
   */
  static extractPointsFromPath(svgPath: string): Array<[number, number]> {
    const points: Array<[number, number]> = [];
    let currentX = 0;
    let currentY = 0;

    // Remove extra whitespace and split by commands
    const cleanPath = svgPath.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

    // Match command letter followed by numbers
    const commandPattern = /([MmLlHhVvCcSsQqTtAaZz])\s*([^MmLlHhVvCcSsQqTtAaZz]*)/g;
    let match;

    while ((match = commandPattern.exec(cleanPath)) !== null) {
      const command = match[1];
      const argsString = match[2].trim();
      const args = argsString ? argsString.split(/\s+/).map(parseFloat) : [];

      switch (command) {
        case 'M': // moveto (absolute)
          currentX = args[0];
          currentY = args[1];
          points.push([currentX, currentY]);
          break;

        case 'm': // moveto (relative)
          currentX += args[0];
          currentY += args[1];
          points.push([currentX, currentY]);
          break;

        case 'L': // lineto (absolute)
          for (let i = 0; i < args.length; i += 2) {
            currentX = args[i];
            currentY = args[i + 1];
            points.push([currentX, currentY]);
          }
          break;

        case 'l': // lineto (relative)
          for (let i = 0; i < args.length; i += 2) {
            currentX += args[i];
            currentY += args[i + 1];
            points.push([currentX, currentY]);
          }
          break;

        case 'H': // horizontal lineto (absolute)
          args.forEach(x => {
            currentX = x;
            points.push([currentX, currentY]);
          });
          break;

        case 'h': // horizontal lineto (relative)
          args.forEach(dx => {
            currentX += dx;
            points.push([currentX, currentY]);
          });
          break;

        case 'V': // vertical lineto (absolute)
          args.forEach(y => {
            currentY = y;
            points.push([currentX, currentY]);
          });
          break;

        case 'v': // vertical lineto (relative)
          args.forEach(dy => {
            currentY += dy;
            points.push([currentX, currentY]);
          });
          break;

        case 'C': // cubic Bézier (absolute)
          for (let i = 0; i < args.length; i += 6) {
            points.push([args[i], args[i + 1]]);       // control point 1
            points.push([args[i + 2], args[i + 3]]);   // control point 2
            currentX = args[i + 4];
            currentY = args[i + 5];
            points.push([currentX, currentY]);         // end point
          }
          break;

        case 'c': // cubic Bézier (relative)
          for (let i = 0; i < args.length; i += 6) {
            points.push([currentX + args[i], currentY + args[i + 1]]);
            points.push([currentX + args[i + 2], currentY + args[i + 3]]);
            currentX += args[i + 4];
            currentY += args[i + 5];
            points.push([currentX, currentY]);
          }
          break;

        case 'Q': // quadratic Bézier (absolute)
          for (let i = 0; i < args.length; i += 4) {
            points.push([args[i], args[i + 1]]);       // control point
            currentX = args[i + 2];
            currentY = args[i + 3];
            points.push([currentX, currentY]);         // end point
          }
          break;

        case 'q': // quadratic Bézier (relative)
          for (let i = 0; i < args.length; i += 4) {
            points.push([currentX + args[i], currentY + args[i + 1]]);
            currentX += args[i + 2];
            currentY += args[i + 3];
            points.push([currentX, currentY]);
          }
          break;

        case 'A': // arc (absolute) - just use end point
          for (let i = 0; i < args.length; i += 7) {
            currentX = args[i + 5];
            currentY = args[i + 6];
            points.push([currentX, currentY]);
          }
          break;

        case 'a': // arc (relative) - just use end point
          for (let i = 0; i < args.length; i += 7) {
            currentX += args[i + 5];
            currentY += args[i + 6];
            points.push([currentX, currentY]);
          }
          break;

        case 'Z':
        case 'z': // closepath
          break;
      }
    }

    return points;
  }

  /**
   * Apply translation to SVG path string
   * Translates all absolute coordinates by (tx, ty)
   */
  static translatePath(svgPath: string, tx: number, ty: number): string {
    const cleanPath = svgPath.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

    let result = '';
    let currentX = 0;
    let currentY = 0;

    const commandPattern = /([MmLlHhVvCcSsQqTtAaZz])\s*([^MmLlHhVvCcSsQqTtAaZz]*)/g;
    let match;

    while ((match = commandPattern.exec(cleanPath)) !== null) {
      const command = match[1];
      const argsString = match[2].trim();
      const args = argsString ? argsString.split(/\s+/).map(parseFloat) : [];

      result += command;

      switch (command) {
        case 'M': // moveto (absolute)
          currentX = args[0] + tx;
          currentY = args[1] + ty;
          result += ` ${currentX},${currentY}`;
          break;

        case 'm': // moveto (relative) - no change needed
          result += ` ${args[0]},${args[1]}`;
          break;

        case 'L': // lineto (absolute)
          for (let i = 0; i < args.length; i += 2) {
            currentX = args[i] + tx;
            currentY = args[i + 1] + ty;
            result += ` ${currentX},${currentY}`;
          }
          break;

        case 'l': // lineto (relative) - no change needed
          for (let i = 0; i < args.length; i += 2) {
            result += ` ${args[i]},${args[i + 1]}`;
          }
          break;

        case 'H': // horizontal lineto (absolute)
          args.forEach((x, i) => {
            currentX = x + tx;
            result += (i > 0 ? ' ' : '') + currentX;
          });
          break;

        case 'h': // horizontal lineto (relative) - no change needed
          result += ` ${args.join(' ')}`;
          break;

        case 'V': // vertical lineto (absolute)
          args.forEach((y, i) => {
            currentY = y + ty;
            result += (i > 0 ? ' ' : '') + currentY;
          });
          break;

        case 'v': // vertical lineto (relative) - no change needed
          result += ` ${args.join(' ')}`;
          break;

        case 'C': // cubic Bézier (absolute)
          for (let i = 0; i < args.length; i += 6) {
            result += ` ${args[i] + tx},${args[i + 1] + ty}`;
            result += ` ${args[i + 2] + tx},${args[i + 3] + ty}`;
            result += ` ${args[i + 4] + tx},${args[i + 5] + ty}`;
          }
          break;

        case 'c': // cubic Bézier (relative) - no change needed
          for (let i = 0; i < args.length; i += 6) {
            result += ` ${args[i]},${args[i + 1]}`;
            result += ` ${args[i + 2]},${args[i + 3]}`;
            result += ` ${args[i + 4]},${args[i + 5]}`;
          }
          break;

        case 'Q': // quadratic Bézier (absolute)
          for (let i = 0; i < args.length; i += 4) {
            result += ` ${args[i] + tx},${args[i + 1] + ty}`;
            result += ` ${args[i + 2] + tx},${args[i + 3] + ty}`;
          }
          break;

        case 'q': // quadratic Bézier (relative) - no change needed
          for (let i = 0; i < args.length; i += 4) {
            result += ` ${args[i]},${args[i + 1]}`;
            result += ` ${args[i + 2]},${args[i + 3]}`;
          }
          break;

        case 'T': // smooth quadratic Bézier (absolute)
          for (let i = 0; i < args.length; i += 2) {
            result += ` ${args[i] + tx},${args[i + 1] + ty}`;
          }
          break;

        case 't': // smooth quadratic Bézier (relative) - no change needed
          for (let i = 0; i < args.length; i += 2) {
            result += ` ${args[i]},${args[i + 1]}`;
          }
          break;

        case 'A': // arc (absolute)
          for (let i = 0; i < args.length; i += 7) {
            result += ` ${args[i]},${args[i + 1]}`;  // rx, ry
            result += ` ${args[i + 2]}`;             // x-axis-rotation
            result += ` ${args[i + 3]},${args[i + 4]}`; // large-arc-flag, sweep-flag
            result += ` ${args[i + 5] + tx},${args[i + 6] + ty}`; // x, y
          }
          break;

        case 'a': // arc (relative) - no change needed
          result += ` ${args.join(' ')}`;
          break;

        case 'Z':
        case 'z': // closepath
          break;
      }

      result += ' ';
    }

    return result.trim();
  }

  /**
   * Calculate bounding box from array of points
   */
  static calculateBoundsFromPoints(points: Array<[number, number]>): { minX: number; minY: number; maxX: number; maxY: number } {
    if (points.length === 0) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    }

    let minX = points[0][0];
    let minY = points[0][1];
    let maxX = points[0][0];
    let maxY = points[0][1];

    points.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });

    return { minX, minY, maxX, maxY };
  }

  /**
   * Calculate bounding box from GreenShape object
   */
  static calculateBounds(shape: GreenShape): { minX: number; minY: number; maxX: number; maxY: number } {
    if (shape.bounds) {
      return shape.bounds;
    }

    if (shape.polygon) {
      return this.calculateBoundsFromPoints(shape.polygon);
    }

    if (shape.svgPath) {
      const points = this.extractPointsFromPath(shape.svgPath);
      return this.calculateBoundsFromPoints(points);
    }

    if (shape.ellipse) {
      // Approximate bounds for ellipse centered at (50, 50)
      return {
        minX: 50 - shape.ellipse.rx,
        minY: 50 - shape.ellipse.ry,
        maxX: 50 + shape.ellipse.rx,
        maxY: 50 + shape.ellipse.ry,
      };
    }

    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }

  /**
   * Create default ellipse shape (for backward compatibility)
   */
  static createDefaultEllipse(): GreenShape {
    return {
      type: 'ellipse',
      ellipse: { rx: 55, ry: 63 },
    };
  }
}
