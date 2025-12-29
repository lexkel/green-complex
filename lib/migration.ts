import { RoundHistory } from './roundHistory';
import { DataAccess } from './dataAccess';

export class DataMigration {
  /**
   * Migrate existing localStorage rounds to IndexedDB
   * Run once on first load after upgrade
   */
  static async migrateFromLocalStorage(): Promise<void> {
    const MIGRATION_KEY = 'gc_migrated_to_indexeddb';

    // Check if already migrated
    if (localStorage.getItem(MIGRATION_KEY) === 'true') {
      console.log('[Migration] Already migrated');
      return;
    }

    console.log('[Migration] Starting migration from localStorage...');

    try {
      // Get existing rounds from localStorage (using sync method)
      const existingRounds = RoundHistory.getRoundsSync();

      if (existingRounds.length === 0) {
        console.log('[Migration] No rounds to migrate');
        localStorage.setItem(MIGRATION_KEY, 'true');
        return;
      }

      // Migrate each round, preserving original timestamps
      // Generate new UUIDs for old round_ IDs
      for (const round of existingRounds) {
        // Only use the old ID if it's already a valid UUID, otherwise generate a new one
        const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(round.id);
        const roundId = isValidUUID ? round.id : crypto.randomUUID();

        await DataAccess.saveRound(round.course, round.putts, {
          roundId,
          createdAt: round.timestamp,
          updatedAt: round.timestamp,
        });
        console.log('[Migration] Migrated round:', round.id, '→', roundId);
      }

      // Mark migration complete
      localStorage.setItem(MIGRATION_KEY, 'true');
      console.log('[Migration] Complete! Migrated', existingRounds.length, 'rounds');

      // Optional: Clear old localStorage data
      // localStorage.removeItem('round_history');

    } catch (error) {
      console.error('[Migration] Failed:', error);
      throw error;
    }
  }
}
