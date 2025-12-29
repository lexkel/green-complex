import Dexie, { Table } from 'dexie';

// Database schema
export interface Round {
  id: string;
  userId: string;
  course: string;
  date: string; // ISO date string
  completed: boolean;
  holesPlayed: number;
  totalPutts: number;
  createdAt: string;
  updatedAt: string;
  dirty: boolean; // True if local changes not yet synced
  syncedAt?: string; // Last successful sync timestamp
}

export interface Hole {
  id: string;
  roundId: string;
  holeNumber: number;
  par: number;
  createdAt: string;
  updatedAt: string;
}

export interface Putt {
  id: string;
  holeId: string;
  roundId: string; // Denormalized for easier querying
  userId: string; // Denormalized for easier querying
  puttNumber: number;
  distance: number;
  made: boolean;
  // Proximity data
  endProximityHorizontal?: number;
  endProximityVertical?: number;
  startProximityHorizontal?: number;
  startProximityVertical?: number;
  // Pin position
  pinPositionX?: number;
  pinPositionY?: number;
  // Metadata
  createdAt: string;
  updatedAt: string;
  dirty: boolean; // True if local changes not yet synced
  syncedAt?: string; // Last successful sync timestamp
}

// Database class
export class GreenComplexDB extends Dexie {
  rounds!: Table<Round>;
  holes!: Table<Hole>;
  putts!: Table<Putt>;

  constructor() {
    super('GreenComplexDB');

    this.version(1).stores({
      rounds: 'id, userId, date, completed, updatedAt, dirty',
      holes: 'id, roundId, holeNumber',
      putts: 'id, holeId, roundId, userId, made, updatedAt, dirty',
    });

    // Version 2: Add syncedAt index for sync queries
    this.version(2).stores({
      rounds: 'id, userId, date, completed, updatedAt, dirty, syncedAt',
      holes: 'id, roundId, holeNumber',
      putts: 'id, holeId, roundId, userId, made, updatedAt, dirty, syncedAt',
    });
  }
}

// Export singleton instance
export const db = new GreenComplexDB();
