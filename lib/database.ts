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
  deleted?: boolean; // True if soft-deleted (for sync)
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
  // New metadata fields
  missDirection?: 'short' | 'long' | 'left' | 'right';
  courseName?: string;
  holeNumber?: number;
  recordedAt?: string; // ISO timestamp when putt was recorded
  // Metadata
  createdAt: string;
  updatedAt: string;
  dirty: boolean; // True if local changes not yet synced
  syncedAt?: string; // Last successful sync timestamp
}

export interface Course {
  id: string;
  userId: string;
  name: string;
  holes: string; // JSON string of hole data
  greenShapes: string; // JSON string of green shapes
  createdAt: string;
  updatedAt: string;
  dirty: boolean;
  syncedAt?: string;
  deleted?: boolean; // True if soft-deleted (for sync)
}

// Database class
export class GreenComplexDB extends Dexie {
  rounds!: Table<Round>;
  holes!: Table<Hole>;
  putts!: Table<Putt>;
  courses!: Table<Course>;

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

    // Version 3: Add courses table
    this.version(3).stores({
      rounds: 'id, userId, date, completed, updatedAt, dirty, syncedAt',
      holes: 'id, roundId, holeNumber',
      putts: 'id, holeId, roundId, userId, made, updatedAt, dirty, syncedAt',
      courses: 'id, userId, updatedAt, dirty, syncedAt',
    });

    // Version 4: Add deleted flag for soft deletion
    this.version(4).stores({
      rounds: 'id, userId, date, completed, updatedAt, dirty, syncedAt, deleted',
      holes: 'id, roundId, holeNumber',
      putts: 'id, holeId, roundId, userId, made, updatedAt, dirty, syncedAt',
      courses: 'id, userId, updatedAt, dirty, syncedAt, deleted',
    });

    // Version 5: Add new metadata fields to putts
    this.version(5).stores({
      rounds: 'id, userId, date, completed, updatedAt, dirty, syncedAt, deleted',
      holes: 'id, roundId, holeNumber',
      putts: 'id, holeId, roundId, userId, made, updatedAt, dirty, syncedAt, courseName, holeNumber, recordedAt, missDirection',
      courses: 'id, userId, updatedAt, dirty, syncedAt, deleted',
    });
  }
}

// Export singleton instance
export const db = new GreenComplexDB();
