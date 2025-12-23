import { PuttingAttempt } from '@/types';

export interface HoleState {
  hole: number;
  puttHistory: Array<{
    puttNum: number;
    distance: number;
    startProximity: any;
    endProximity: any;
    endDistance: number;
    made?: boolean;
  }>;
  pinPosition: { x: number; y: number };
  ballPosition: { x: number; y: number } | null;
  distance: number;
  distanceInputValue: string;
  puttNumber: number;
  holeComplete: boolean;
  greenScale: number;
  greenShape: { rx: number; ry: number };
  canvasZoom: number;
  viewBoxOffset: { x: number; y: number };
  pendingPutts: PuttingAttempt[];
}

export interface ActiveRoundData {
  id: string;
  courseId: string;
  courseName: string;
  startTimestamp: string;
  currentHole: number;
  lastCompletedHole: number;
  pendingPutts: PuttingAttempt[];
  holeStates: Record<number, HoleState>;
}

const STORAGE_KEY = 'active_round';

export class ActiveRoundStorage {
  static saveActiveRound(data: ActiveRoundData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save active round:', error);
    }
  }

  static loadActiveRound(): ActiveRoundData | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load active round:', error);
      return null;
    }
  }

  static clearActiveRound(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear active round:', error);
    }
  }

  static hasActiveRound(): boolean {
    return !!localStorage.getItem(STORAGE_KEY);
  }

  static getActiveRoundSummary() {
    const round = this.loadActiveRound();
    if (!round) return null;

    const holesWithPutts = new Set(round.pendingPutts.map(p => p.holeNumber).filter(h => h !== undefined));

    return {
      courseName: round.courseName,
      startTime: new Date(round.startTimestamp),
      totalPutts: round.pendingPutts.length,
      holesPlayed: holesWithPutts.size,
      currentHole: round.currentHole,
      lastCompletedHole: round.lastCompletedHole,
    };
  }
}
