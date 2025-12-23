import { PuttingAttempt } from '@/types';

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
  static saveRound(putts: PuttingAttempt[], course: string): void {
    if (typeof window === 'undefined') return;

    const rounds = this.getRounds();

    // Calculate stats for this round
    const holesPlayed = new Set(putts.map(p => p.holeNumber).filter(h => h !== undefined)).size;

    const newRound: SavedRound = {
      id: `round_${Date.now()}`,
      timestamp: new Date().toISOString(),
      course,
      putts,
      holesPlayed,
      totalPutts: putts.length,
    };

    // Add new round to the beginning
    rounds.unshift(newRound);

    // Keep only the last 10 rounds
    const limitedRounds = rounds.slice(0, MAX_ROUNDS);

    try {
      localStorage.setItem(ROUND_HISTORY_KEY, JSON.stringify(limitedRounds));
    } catch (error) {
      console.error('Error saving round history:', error);
    }
  }

  static getRounds(): SavedRound[] {
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

  static getRound(id: string): SavedRound | undefined {
    const rounds = this.getRounds();
    return rounds.find(r => r.id === id);
  }

  static updateRound(id: string, updates: Partial<Pick<SavedRound, 'course' | 'timestamp'>>): void {
    if (typeof window === 'undefined') return;

    const rounds = this.getRounds();
    const updatedRounds = rounds.map(round => {
      if (round.id === id) {
        return { ...round, ...updates };
      }
      return round;
    });

    try {
      localStorage.setItem(ROUND_HISTORY_KEY, JSON.stringify(updatedRounds));
    } catch (error) {
      console.error('Error updating round:', error);
    }
  }

  static deleteRound(id: string): void {
    if (typeof window === 'undefined') return;

    const rounds = this.getRounds();
    const filtered = rounds.filter(r => r.id !== id);

    try {
      localStorage.setItem(ROUND_HISTORY_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting round:', error);
    }
  }

  static clearAll(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(ROUND_HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing round history:', error);
    }
  }
}
