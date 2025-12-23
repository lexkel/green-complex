import { PuttingAttempt } from '@/types';

const SPREADSHEET_NAME = 'Putting Stats';
const SHEET_NAME = 'Putting Stats';
const HEADERS = ['Date', 'Time', 'Course', 'Hole', 'Putt Number', 'Start Proximity (m)', 'Start Position', 'End Proximity (m)', 'Holed', 'Miss'];

export class GoogleSheetsService {
  private accessToken: string;
  private spreadsheetId: string | null = null;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async apiRequest(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      // If unauthorized, clear the token and force re-login
      if (response.status === 401) {
        localStorage.removeItem('google_access_token');
        window.location.reload();
        throw new Error('Authentication expired. Please sign in again.');
      }

      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  async findOrCreateSpreadsheet(): Promise<string> {
    if (this.spreadsheetId) {
      return this.spreadsheetId;
    }

    try {
      const searchResponse = await this.apiRequest(
        `https://www.googleapis.com/drive/v3/files?q=name='${SPREADSHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name)`
      );

      if (searchResponse.files && searchResponse.files.length > 0) {
        this.spreadsheetId = searchResponse.files[0].id;
        await this.ensureSheetStructure();
        return this.spreadsheetId!;
      }

      const createResponse = await this.apiRequest(
        'https://sheets.googleapis.com/v4/spreadsheets',
        {
          method: 'POST',
          body: JSON.stringify({
            properties: {
              title: SPREADSHEET_NAME,
            },
            sheets: [
              {
                properties: {
                  title: SHEET_NAME,
                },
              },
            ],
          }),
        }
      );

      this.spreadsheetId = createResponse.spreadsheetId;
      await this.setupHeaders();
      return this.spreadsheetId!;
    } catch (error) {
      console.error('Error finding/creating spreadsheet:', error);
      throw error;
    }
  }

  private async ensureSheetStructure() {
    if (!this.spreadsheetId) return;

    try {
      const response = await this.apiRequest(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}?fields=sheets(properties(title))`
      );

      const hasSheet = response.sheets?.some(
        (sheet: any) => sheet.properties.title === SHEET_NAME
      );

      if (!hasSheet) {
        await this.apiRequest(
          `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`,
          {
            method: 'POST',
            body: JSON.stringify({
              requests: [
                {
                  addSheet: {
                    properties: {
                      title: SHEET_NAME,
                    },
                  },
                },
              ],
            }),
          }
        );
        await this.setupHeaders();
      }
    } catch (error) {
      console.error('Error ensuring sheet structure:', error);
    }
  }

  private async setupHeaders() {
    if (!this.spreadsheetId) return;

    await this.apiRequest(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${SHEET_NAME}!A1:J1?valueInputOption=RAW`,
      {
        method: 'PUT',
        body: JSON.stringify({
          values: [HEADERS],
        }),
      }
    );
  }

  private calculateProximityDistance(proximity?: { horizontal: number; vertical: number }): number {
    if (!proximity) return 0;
    return Math.sqrt(proximity.horizontal * proximity.horizontal + proximity.vertical * proximity.vertical);
  }

  private calculateStartPosition(proximity?: { horizontal: number; vertical: number }): string {
    if (!proximity) return '-';

    const angleRad = Math.atan2(proximity.vertical, proximity.horizontal);
    const angleDeg = (angleRad * 180 / Math.PI);

    // Determine quadrant based on 45-degree divisions - absolute position relative to pin
    if (angleDeg >= -45 && angleDeg < 45) {
      return 'Right';
    } else if (angleDeg >= 45 && angleDeg < 135) {
      return 'Long';
    } else if (angleDeg >= 135 || angleDeg < -135) {
      return 'Left';
    } else {
      return 'Short';
    }
  }

  private calculateMissDirection(startProximity?: { horizontal: number; vertical: number }, endProximity?: { horizontal: number; vertical: number }): string {
    if (!startProximity || !endProximity) return '-';

    // Get the angle from pin to START position (this becomes our reference 0°)
    const startAngle = Math.atan2(startProximity.vertical, startProximity.horizontal);

    // Get the angle from pin to END position
    const endAngle = Math.atan2(endProximity.vertical, endProximity.horizontal);

    // Calculate relative angle: how much did the end position rotate from start?
    let relativeAngle = (endAngle - startAngle) * 180 / Math.PI;

    // Normalize to -180 to 180
    while (relativeAngle > 180) relativeAngle -= 360;
    while (relativeAngle < -180) relativeAngle += 360;

    // Apply quadrants with start position as reference:
    // -45° to 45° = SHORT (towards pin)
    // 45° to 135° = RIGHT (perpendicular right from target line)
    // 135° to -135° = LONG (past the pin, away from start)
    // -135° to -45° = LEFT (perpendicular left from target line)

    const absRelativeAngle = Math.abs(relativeAngle);

    if (absRelativeAngle > 135) {
      // Ball went to opposite side of pin from where we started - LONG
      return 'Long';
    } else if (relativeAngle >= -45 && relativeAngle <= 45) {
      // Ball stayed on line towards pin - SHORT
      return 'Short';
    } else if (relativeAngle > 45 && relativeAngle <= 135) {
      // Ball veered to the right of target line
      return 'Right';
    } else {
      // Ball veered to the left of target line (-135 to -45)
      return 'Left';
    }
  }

  async addPutt(putt: PuttingAttempt): Promise<void> {
    if (!this.spreadsheetId) {
      await this.findOrCreateSpreadsheet();
    }

    const date = new Date(putt.timestamp);
    const dateStr = date.toLocaleDateString('en-GB'); // "16/12/2025"
    const timeStr = date.toLocaleTimeString('en-GB', { hour12: false }); // "14:32:15"

    // Calculate start proximity distance (distance from pin at start)
    const startProximityDistance = putt.distance;

    // Calculate start position direction - only for putt 1
    const startPosition = (putt.puttNumber === 1) ? this.calculateStartPosition(putt.startProximity) : '-';

    // Calculate end proximity (distance from pin at end)
    const endProximity = putt.made ? 0 : this.calculateProximityDistance(putt.proximity);

    // Calculate miss direction (relative to putting direction)
    const missDirection = putt.made ? '-' : this.calculateMissDirection(putt.startProximity, putt.proximity);

    const row = [
      dateStr,                                    // Date
      timeStr,                                    // Time
      putt.course || '',                          // Course
      putt.holeNumber || '',                      // Hole
      putt.puttNumber || '',                      // Putt Number
      startProximityDistance.toFixed(1),          // Start Proximity (m)
      startPosition,                              // Start Position
      endProximity.toFixed(1),                    // End Proximity (m)
      putt.made ? 'Yes' : 'No',                  // Holed
      missDirection,                              // Miss
    ];

    await this.apiRequest(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${SHEET_NAME}!A:J:append?valueInputOption=RAW`,
      {
        method: 'POST',
        body: JSON.stringify({
          values: [row],
        }),
      }
    );
  }

  async addMultiplePutts(putts: PuttingAttempt[]): Promise<void> {
    if (!this.spreadsheetId) {
      await this.findOrCreateSpreadsheet();
    }

    const rows = putts.map(putt => {
      const date = new Date(putt.timestamp);
      const dateStr = date.toLocaleDateString('en-GB');
      const timeStr = date.toLocaleTimeString('en-GB', { hour12: false });

      const startProximityDistance = putt.distance;
      const startPosition = (putt.puttNumber === 1) ? this.calculateStartPosition(putt.startProximity) : '-';
      const endProximity = putt.made ? 0 : this.calculateProximityDistance(putt.proximity);
      const missDirection = putt.made ? '-' : this.calculateMissDirection(putt.startProximity, putt.proximity);

      return [
        dateStr,                                    // Date
        timeStr,                                    // Time
        putt.course || '',                          // Course
        putt.holeNumber || '',                      // Hole
        putt.puttNumber || '',                      // Putt Number
        startProximityDistance.toFixed(1),          // Start Proximity (m)
        startPosition,                              // Start Position
        endProximity.toFixed(1),                    // End Proximity (m)
        putt.made ? 'Yes' : 'No',                  // Holed
        missDirection,                              // Miss
      ];
    });

    await this.apiRequest(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${SHEET_NAME}!A:J:append?valueInputOption=RAW`,
      {
        method: 'POST',
        body: JSON.stringify({
          values: rows,
        }),
      }
    );
  }

  async getAllPutts(): Promise<PuttingAttempt[]> {
    if (!this.spreadsheetId) {
      await this.findOrCreateSpreadsheet();
    }

    try {
      const response = await this.apiRequest(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${SHEET_NAME}!A2:J`
      );

      if (!response.values || response.values.length === 0) {
        return [];
      }

      return response.values.map((row: string[]) => {
        // Parse date and time back into ISO timestamp
        const dateStr = row[0] || '';
        const timeStr = row[1] || '';
        let timestamp: string;

        if (dateStr && timeStr) {
          // Convert "DD/MM/YYYY HH:MM:SS" to ISO string
          const [day, month, year] = dateStr.split('/');
          const dateTimeStr = `${year}-${month}-${day}T${timeStr}`;
          timestamp = new Date(dateTimeStr).toISOString();
        } else {
          timestamp = new Date().toISOString();
        }

        // Row structure: Date, Time, Course, Hole, Putt Number, Start Proximity (m), Start Position, End Proximity (m), Holed, Miss
        const course = row[2] || undefined;
        const holeNumber = parseInt(row[3]) || undefined;
        const puttNumber = parseInt(row[4]) || undefined;
        const startProximityDistance = parseFloat(row[5]) || 0;
        const startPosition = row[6] || '';  // Long/Short/Left/Right
        const endProximity = parseFloat(row[7]) || 0;
        const made = row[8]?.toLowerCase() === 'yes';
        const missDirection = row[9] || '';

        // Reconstruct proximity data from miss direction and end proximity
        // We don't have the exact x/y coordinates, so proximity is undefined for read-back
        const proximity = undefined;

        return {
          timestamp,
          holeNumber,
          puttNumber,
          distance: startProximityDistance,
          distanceUnit: 'metres' as 'metres' | 'feet',
          made,
          proximity,
          course,
        };
      });
    } catch (error) {
      console.error('Error fetching putts:', error);
      return [];
    }
  }
}
