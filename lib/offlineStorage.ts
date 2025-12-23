import { QueuedPutt, PuttingAttempt } from '@/types';

const QUEUE_KEY = 'putting-stats-queue';

export class OfflineStorage {
  static getQueue(): QueuedPutt[] {
    if (typeof window === 'undefined') return [];

    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static addToQueue(putt: PuttingAttempt): QueuedPutt {
    const queuedPutt: QueuedPutt = {
      ...putt,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      synced: false,
    };

    const queue = this.getQueue();
    queue.push(queuedPutt);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

    return queuedPutt;
  }

  static markAsSynced(id: string): void {
    const queue = this.getQueue();
    const updated = queue.map(putt =>
      putt.id === id ? { ...putt, synced: true } : putt
    );
    localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  }

  static removeFromQueue(id: string): void {
    const queue = this.getQueue();
    const filtered = queue.filter(putt => putt.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  }

  static getUnsyncedPutts(): QueuedPutt[] {
    return this.getQueue().filter(putt => !putt.synced);
  }

  static clearSynced(): void {
    const queue = this.getQueue();
    const unsynced = queue.filter(putt => !putt.synced);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(unsynced));
  }

  static isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }
}
