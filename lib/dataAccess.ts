import { db, Round, Hole, Putt } from './database';
import { UserIdentity } from './userIdentity';
import { PuttingAttempt } from '@/types';

export class DataAccess {
  /**
   * Save a completed round with all putts
   * Accepts optional timestamps to preserve historical data during migration
   */
  static async saveRound(
    course: string,
    putts: PuttingAttempt[],
    options?: {
      roundId?: string;
      createdAt?: string;
      updatedAt?: string;
    }
  ): Promise<string> {
    const { id: userId } = UserIdentity.getUserId();
    const roundId = options?.roundId || crypto.randomUUID();
    const now = new Date().toISOString();
    const createdAt = options?.createdAt || now;
    const updatedAt = options?.updatedAt || now;

    // Group putts by hole
    const puttsByHole = new Map<number, PuttingAttempt[]>();
    putts.forEach(p => {
      if (!p.holeNumber) return;
      if (!puttsByHole.has(p.holeNumber)) {
        puttsByHole.set(p.holeNumber, []);
      }
      puttsByHole.get(p.holeNumber)!.push(p);
    });

    const holesPlayed = puttsByHole.size;

    // Create round
    const round: Round = {
      id: roundId,
      userId,
      course,
      date: createdAt, // Use provided or current timestamp
      completed: true,
      holesPlayed,
      totalPutts: putts.length,
      createdAt,
      updatedAt,
      dirty: true, // New data always marked dirty until synced
    };

    // Create holes and putts
    const holes: Hole[] = [];
    const puttRecords: Putt[] = [];

    puttsByHole.forEach((holePutts, holeNumber) => {
      const holeId = crypto.randomUUID();

      // Get par from first putt (if available) or default to 4
      const par = 4; // TODO: Get from course data

      holes.push({
        id: holeId,
        roundId,
        holeNumber,
        par,
        createdAt,
        updatedAt,
      });

      holePutts.forEach((putt, idx) => {
        puttRecords.push({
          id: crypto.randomUUID(),
          holeId,
          roundId,
          userId,
          puttNumber: putt.puttNumber || idx + 1,
          distance: putt.distance,
          made: putt.made,
          endProximityHorizontal: putt.proximity?.horizontal,
          endProximityVertical: putt.proximity?.vertical,
          startProximityHorizontal: putt.startProximity?.horizontal,
          startProximityVertical: putt.startProximity?.vertical,
          pinPositionX: putt.pinPosition?.x,
          pinPositionY: putt.pinPosition?.y,
          createdAt,
          updatedAt,
          dirty: true, // New data always marked dirty until synced
        });
      });
    });

    // Save to database (transaction)
    await db.transaction('rw', db.rounds, db.holes, db.putts, async () => {
      await db.rounds.add(round);
      await db.holes.bulkAdd(holes);
      await db.putts.bulkAdd(puttRecords);
    });

    return roundId;
  }

  /**
   * Get all rounds for current user
   */
  static async getRounds(): Promise<Round[]> {
    const { id: userId } = UserIdentity.getUserId();
    return db.rounds
      .where('userId')
      .equals(userId)
      .reverse()
      .sortBy('date');
  }

  /**
   * Get all putts for stats calculation
   */
  static async getAllPutts(): Promise<PuttingAttempt[]> {
    const { id: userId } = UserIdentity.getUserId();
    const putts = await db.putts
      .where('userId')
      .equals(userId)
      .toArray();

    // Convert back to PuttingAttempt format
    return putts.map(p => ({
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
    }));
  }

  /**
   * Delete a round
   */
  static async deleteRound(roundId: string): Promise<void> {
    await db.transaction('rw', db.rounds, db.holes, db.putts, async () => {
      // Get holes for this round
      const holes = await db.holes.where('roundId').equals(roundId).toArray();
      const holeIds = holes.map(h => h.id);

      // Delete putts for these holes
      await db.putts.where('holeId').anyOf(holeIds).delete();

      // Delete holes
      await db.holes.where('roundId').equals(roundId).delete();

      // Delete round
      await db.rounds.delete(roundId);
    });
  }

  /**
   * Get total database size (for settings display)
   */
  static async getDatabaseSize(): Promise<number> {
    const rounds = await db.rounds.count();
    const holes = await db.holes.count();
    const putts = await db.putts.count();

    // Rough estimate in KB
    return (rounds * 0.5) + (holes * 0.2) + (putts * 0.3);
  }
}
