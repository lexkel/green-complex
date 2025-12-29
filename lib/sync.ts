import { supabase } from './supabaseClient';
import { db, Round, Hole, Putt } from './database';
import { UserIdentity } from './userIdentity';

export interface SyncStatus {
  lastSyncAt: string | null;
  isSyncing: boolean;
  pendingChanges: number;
  lastError: string | null;
}

export class SyncService {
  private static syncInProgress = false;
  private static lastSyncTime: string | null = null;

  /**
   * Get current sync status
   */
  static async getSyncStatus(): Promise<SyncStatus> {
    const dirtyRounds = await db.rounds.filter(r => r.dirty === true).count();
    const dirtyPutts = await db.putts.filter(p => p.dirty === true).count();

    return {
      lastSyncAt: this.lastSyncTime,
      isSyncing: this.syncInProgress,
      pendingChanges: dirtyRounds + dirtyPutts,
      lastError: null, // TODO: Track errors
    };
  }

  /**
   * Sync local changes to cloud (upload)
   */
  static async syncUp(): Promise<void> {
    if (!supabase) {
      console.warn('[Sync] Supabase not configured - skipping sync up');
      return;
    }

    if (this.syncInProgress) {
      console.log('[Sync] Sync already in progress, skipping');
      return;
    }

    this.syncInProgress = true;
    const { id: userId } = UserIdentity.getUserId();

    try {
      console.log('[Sync] Starting sync up...');

      // Get all dirty rounds
      const dirtyRounds = await db.rounds.filter(r => r.dirty === true).toArray();

      for (const round of dirtyRounds) {
        // Get holes for this round
        const holes = await db.holes.where('roundId').equals(round.id).toArray();

        // Get putts for this round
        const dirtyPutts = await db.putts.where('roundId').equals(round.id).toArray();

        // Upsert round to Supabase
        const { error: roundError } = await supabase
          .from('rounds')
          .upsert({
            id: round.id,
            user_id: round.userId,
            course: round.course,
            date: round.date,
            completed: round.completed,
            holes_played: round.holesPlayed,
            total_putts: round.totalPutts,
            created_at: round.createdAt,
            updated_at: round.updatedAt,
          }, {
            onConflict: 'id',
          });

        if (roundError) {
          console.error('[Sync] Error syncing round:', roundError);
          continue;
        }

        // Upsert holes
        if (holes.length > 0) {
          const { error: holesError } = await supabase
            .from('holes')
            .upsert(holes.map(h => ({
              id: h.id,
              round_id: h.roundId,
              hole_number: h.holeNumber,
              par: h.par,
              created_at: h.createdAt,
              updated_at: h.updatedAt,
            })), {
              onConflict: 'id',
            });

          if (holesError) {
            console.error('[Sync] Error syncing holes:', holesError);
            continue;
          }
        }

        // Upsert putts
        if (dirtyPutts.length > 0) {
          const { error: puttsError } = await supabase
            .from('putts')
            .upsert(dirtyPutts.map(p => ({
              id: p.id,
              hole_id: p.holeId,
              round_id: p.roundId,
              user_id: p.userId,
              putt_number: p.puttNumber,
              distance: p.distance,
              made: p.made,
              end_proximity_horizontal: p.endProximityHorizontal,
              end_proximity_vertical: p.endProximityVertical,
              start_proximity_horizontal: p.startProximityHorizontal,
              start_proximity_vertical: p.startProximityVertical,
              pin_position_x: p.pinPositionX,
              pin_position_y: p.pinPositionY,
              created_at: p.createdAt,
              updated_at: p.updatedAt,
            })), {
              onConflict: 'id',
            });

          if (puttsError) {
            console.error('[Sync] Error syncing putts:', puttsError);
            continue;
          }

          // Mark putts as clean
          for (const putt of dirtyPutts) {
            await db.putts.update(putt.id, {
              dirty: false,
              syncedAt: new Date().toISOString(),
            });
          }
        }

        // Mark round as clean
        await db.rounds.update(round.id, {
          dirty: false,
          syncedAt: new Date().toISOString(),
        });

        console.log('[Sync] Synced round:', round.id);
      }

      this.lastSyncTime = new Date().toISOString();
      console.log('[Sync] Sync up complete');

    } catch (error) {
      console.error('[Sync] Sync up failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync cloud changes to local (download)
   */
  static async syncDown(): Promise<void> {
    if (!supabase) {
      console.warn('[Sync] Supabase not configured - skipping sync down');
      return;
    }

    if (this.syncInProgress) {
      console.log('[Sync] Sync already in progress, skipping');
      return;
    }

    this.syncInProgress = true;
    const { id: userId } = UserIdentity.getUserId();

    try {
      console.log('[Sync] Starting sync down...');

      // Get last sync time from most recent synced record
      const lastSyncedRound = await db.rounds
        .where('syncedAt')
        .above('')
        .reverse()
        .sortBy('syncedAt');

      const lastSyncTime = lastSyncedRound[0]?.syncedAt || '1970-01-01T00:00:00.000Z';

      // Fetch rounds updated since last sync
      const { data: remoteRounds, error: roundsError } = await supabase
        .from('rounds')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', lastSyncTime)
        .order('updated_at', { ascending: true });

      if (roundsError) {
        console.error('[Sync] Error fetching remote rounds:', roundsError);
        return;
      }

      if (!remoteRounds || remoteRounds.length === 0) {
        console.log('[Sync] No remote changes to sync');
        return;
      }

      console.log('[Sync] Found', remoteRounds.length, 'remote rounds to sync');

      for (const remoteRound of remoteRounds) {
        // Check if round exists locally
        const localRound = await db.rounds.get(remoteRound.id);

        // Conflict resolution: last-write-wins by updatedAt
        if (localRound) {
          const localTime = new Date(localRound.updatedAt).getTime();
          const remoteTime = new Date(remoteRound.updated_at).getTime();

          if (localTime > remoteTime) {
            console.log('[Sync] Local round is newer, keeping local version:', remoteRound.id);
            continue; // Skip this round, local is newer
          }
        }

        // Fetch holes for this round
        const { data: remoteHoles, error: holesError } = await supabase
          .from('holes')
          .select('*')
          .eq('round_id', remoteRound.id);

        if (holesError) {
          console.error('[Sync] Error fetching remote holes:', holesError);
          continue;
        }

        // Fetch putts for this round
        const { data: remotePutts, error: puttsError } = await supabase
          .from('putts')
          .select('*')
          .eq('round_id', remoteRound.id);

        if (puttsError) {
          console.error('[Sync] Error fetching remote putts:', puttsError);
          continue;
        }

        // Save to local database (transaction)
        await db.transaction('rw', db.rounds, db.holes, db.putts, async () => {
          // Upsert round
          await db.rounds.put({
            id: remoteRound.id,
            userId: remoteRound.user_id,
            course: remoteRound.course,
            date: remoteRound.date,
            completed: remoteRound.completed,
            holesPlayed: remoteRound.holes_played,
            totalPutts: remoteRound.total_putts,
            createdAt: remoteRound.created_at,
            updatedAt: remoteRound.updated_at,
            dirty: false, // Remote data is clean
            syncedAt: new Date().toISOString(),
          });

          // Upsert holes
          if (remoteHoles) {
            for (const hole of remoteHoles) {
              await db.holes.put({
                id: hole.id,
                roundId: hole.round_id,
                holeNumber: hole.hole_number,
                par: hole.par,
                createdAt: hole.created_at,
                updatedAt: hole.updated_at,
              });
            }
          }

          // Upsert putts
          if (remotePutts) {
            for (const putt of remotePutts) {
              await db.putts.put({
                id: putt.id,
                holeId: putt.hole_id,
                roundId: putt.round_id,
                userId: putt.user_id,
                puttNumber: putt.putt_number,
                distance: putt.distance,
                made: putt.made,
                endProximityHorizontal: putt.end_proximity_horizontal,
                endProximityVertical: putt.end_proximity_vertical,
                startProximityHorizontal: putt.start_proximity_horizontal,
                startProximityVertical: putt.start_proximity_vertical,
                pinPositionX: putt.pin_position_x,
                pinPositionY: putt.pin_position_y,
                createdAt: putt.created_at,
                updatedAt: putt.updated_at,
                dirty: false, // Remote data is clean
                syncedAt: new Date().toISOString(),
              });
            }
          }
        });

        console.log('[Sync] Synced down round:', remoteRound.id);
      }

      this.lastSyncTime = new Date().toISOString();
      console.log('[Sync] Sync down complete');

    } catch (error) {
      console.error('[Sync] Sync down failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Bi-directional sync (down then up)
   */
  static async sync(): Promise<void> {
    await this.syncDown(); // Get remote changes first
    await this.syncUp();   // Then push local changes
  }

  /**
   * Start automatic background sync (call on app init)
   */
  static startAutoSync(intervalMs: number = 30000): void {
    // Initial sync
    this.sync().catch(error => {
      console.error('[Sync] Initial sync failed:', error);
    });

    // Periodic sync
    setInterval(() => {
      if (navigator.onLine) {
        this.sync().catch(error => {
          console.error('[Sync] Auto sync failed:', error);
        });
      }
    }, intervalMs);

    // Sync on network reconnection
    window.addEventListener('online', () => {
      console.log('[Sync] Network reconnected, syncing...');
      this.sync().catch(error => {
        console.error('[Sync] Reconnect sync failed:', error);
      });
    });
  }
}
