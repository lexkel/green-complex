import { PuttingAttempt } from '@/types';
import { DataAccess } from './dataAccess';
import { db } from './database';

export interface SavedRound {
  id: string;
  timestamp: string;
  course: string;
  putts: PuttingAttempt[];
  holesPlayed: number;
  totalPutts: number;
}

const ROUND_HISTORY_KEY = 'round_history';
const MAX_ROUNDS = 10;

export class RoundHistory {
  // NEW: Async version using IndexedDB
  static async saveRound(putts: PuttingAttempt[], course: string): Promise<void> {
    await DataAccess.saveRound(course, putts);
  }

  // NEW: Async version using IndexedDB
  static async getRounds(): Promise<SavedRound[]> {
    const rounds = await DataAccess.getRounds();

    // Convert to SavedRound format
    const savedRounds: SavedRound[] = await Promise.all(
      rounds.map(async (round) => {
        // Get putts for this round
        const putts = await db.putts
          .where('roundId')
          .equals(round.id)
          .sortBy('puttNumber');

        // Get holes for this round
        const holes = await db.holes
          .where('roundId')
          .equals(round.id)
          .toArray();

        // Create a map of holeId to holeNumber for quick lookup
        const holeMap = new Map(holes.map(h => [h.id, h.holeNumber]));

        // Convert back to PuttingAttempt format
        const puttingAttempts: PuttingAttempt[] = putts.map(p => ({
          timestamp: p.createdAt,
          distance: p.distance,
          distanceUnit: 'metres' as const,
          made: p.made,
          proximity: (p.endProximityHorizontal !== undefined && p.endProximityVertical !== undefined)
            ? { horizontal: p.endProximityHorizontal, vertical: p.endProximityVertical }
            : undefined,
          startProximity: (p.startProximityHorizontal !== undefined && p.startProximityVertical !== undefined)
            ? { horizontal: p.startProximityHorizontal, vertical: p.startProximityVertical }
            : undefined,
          pinPosition: (p.pinPositionX !== undefined && p.pinPositionY !== undefined)
            ? { x: p.pinPositionX, y: p.pinPositionY }
            : undefined,
          puttNumber: p.puttNumber,
          holeNumber: holeMap.get(p.holeId),
        }));

        return {
          id: round.id,
          timestamp: round.createdAt,
          course: round.course,
          putts: puttingAttempts,
          holesPlayed: round.holesPlayed,
          totalPutts: round.totalPutts,
        };
      })
    );

    return savedRounds;
  }

  // NEW: Async version using IndexedDB
  static async getRound(id: string): Promise<SavedRound | undefined> {
    const rounds = await this.getRounds();
    return rounds.find(r => r.id === id);
  }

  // NEW: Async version using IndexedDB
  static async updateRound(id: string, updates: Partial<Pick<SavedRound, 'course' | 'timestamp'>>): Promise<void> {
    await db.rounds.update(id, {
      ...(updates.course && { course: updates.course }),
      ...(updates.timestamp && { date: updates.timestamp }),
      updatedAt: new Date().toISOString(),
      dirty: true,
    });
  }

  // NEW: Async version using IndexedDB
  static async deleteRound(id: string): Promise<void> {
    await DataAccess.deleteRound(id);
  }

  // NEW: Async version using IndexedDB
  static async clearAll(): Promise<void> {
    await db.transaction('rw', db.rounds, db.holes, db.putts, async () => {
      await db.putts.clear();
      await db.holes.clear();
      await db.rounds.clear();
    });
  }

  // LEGACY: Synchronous localStorage methods for migration only
  // These are kept for the migration process
  static getRoundsSync(): SavedRound[] {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(ROUND_HISTORY_KEY);
      if (!stored) return [];

      const rounds = JSON.parse(stored);
      if (!Array.isArray(rounds)) return [];

      // Sort by timestamp, most recent first
      return rounds.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return dateB - dateA; // Most recent first
      });
    } catch (error) {
      console.error('Error reading round history:', error);
      return [];
    }
  }
}
