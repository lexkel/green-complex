import { PuttingAttempt, PuttingStats } from '@/types';

export class StatsCalculator {
  static calculateStats(putts: PuttingAttempt[], unit: 'metres' | 'feet' = 'metres'): PuttingStats {
    const convertedPutts = putts.map(putt => ({
      ...putt,
      distance: putt.distanceUnit === unit
        ? putt.distance
        : (unit === 'metres' ? putt.distance / 3.28084 : putt.distance * 3.28084)
    }));

    const totalPutts = convertedPutts.length;
    const totalMade = convertedPutts.filter(p => p.made).length;
    const overallPercentage = totalPutts > 0 ? (totalMade / totalPutts) * 100 : 0;

    const ranges = unit === 'metres'
      ? [
          { min: 0, max: 1, label: '0-1m' },
          { min: 1, max: 2, label: '1-2m' },
          { min: 2, max: 3, label: '2-3m' },
          { min: 3, max: 5, label: '3-5m' },
          { min: 5, max: 10, label: '5-10m' },
          { min: 10, max: Infinity, label: '10m+' },
        ]
      : [
          { min: 0, max: 3, label: '0-3ft' },
          { min: 3, max: 6, label: '3-6ft' },
          { min: 6, max: 10, label: '6-10ft' },
          { min: 10, max: 15, label: '10-15ft' },
          { min: 15, max: 30, label: '15-30ft' },
          { min: 30, max: Infinity, label: '30ft+' },
        ];

    const byDistance = ranges.map(range => {
      const rangePutts = convertedPutts.filter(
        p => p.distance >= range.min && p.distance < range.max
      );
      const attempts = rangePutts.length;
      const made = rangePutts.filter(p => p.made).length;
      const percentage = attempts > 0 ? (made / attempts) * 100 : 0;

      return {
        range: range.label,
        attempts,
        made,
        percentage,
      };
    });

    return {
      totalPutts,
      totalMade,
      overallPercentage,
      byDistance,
    };
  }

  static getRecentSessions(putts: PuttingAttempt[], sessionCount: number = 5): PuttingAttempt[][] {
    const sortedPutts = [...putts].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const sessions: PuttingAttempt[][] = [];
    let currentSession: PuttingAttempt[] = [];
    let lastDate: Date | null = null;

    for (const putt of sortedPutts) {
      const puttDate = new Date(putt.timestamp);
      const puttDay = new Date(puttDate.getFullYear(), puttDate.getMonth(), puttDate.getDate());

      if (!lastDate) {
        currentSession.push(putt);
        lastDate = puttDay;
      } else if (puttDay.getTime() === lastDate.getTime()) {
        currentSession.push(putt);
      } else {
        sessions.push(currentSession);
        if (sessions.length >= sessionCount) break;
        currentSession = [putt];
        lastDate = puttDay;
      }
    }

    if (currentSession.length > 0 && sessions.length < sessionCount) {
      sessions.push(currentSession);
    }

    return sessions;
  }
}
