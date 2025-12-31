export interface ProximityData {
  horizontal: number; // positive = right, negative = left (metres)
  vertical: number;   // positive = long, negative = short (metres)
}

export interface PuttingAttempt {
  timestamp: string;
  distance: number;
  distanceUnit: 'metres' | 'feet';
  made: boolean;
  proximity?: ProximityData;  // End proximity for missed putts
  startProximity?: ProximityData;  // Start proximity (position on green)
  pinPosition?: { x: number; y: number };  // Pin position on green canvas
  puttNumber?: number;
  holeNumber?: number;
  conditions?: 'fast' | 'medium' | 'slow';
  course?: string;
  notes?: string;
  missDirection?: 'short' | 'long' | 'left' | 'right';  // Miss direction for missed putts
}

export interface PuttingStats {
  totalPutts: number;
  totalMade: number;
  overallPercentage: number;
  byDistance: {
    range: string;
    attempts: number;
    made: number;
    percentage: number;
  }[];
}

export interface QueuedPutt extends PuttingAttempt {
  id: string;
  synced: boolean;
}
