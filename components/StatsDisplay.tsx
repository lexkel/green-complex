'use client';

import { PuttingStats, PuttingAttempt } from '@/types';
import { StatsCalculator } from '@/lib/statsCalculator';
import { RoundHistory, SavedRound } from '@/lib/roundHistory';
import { useEffect, useState } from 'react';

interface StatsDisplayProps {
  putts: PuttingAttempt[];
  unit: 'metres' | 'feet';
}

interface RoundStats {
  roundNumber: number;
  totalPutts: number;
  avgPutts: number;
  timestamp: string;
  totalMadeDistance: number;
}

export function StatsDisplay({ putts, unit }: StatsDisplayProps) {
  const [rounds, setRounds] = useState<SavedRound[]>([]);
  const [showFirstPuttsOnly, setShowFirstPuttsOnly] = useState(false);
  const [missDistanceFilter, setMissDistanceFilter] = useState<'all' | 'short' | 'medium' | 'long'>('all');

  useEffect(() => {
    RoundHistory.getRounds().then(setRounds);
  }, [putts]);

  if (putts.length === 0) {
    return (
      <div className="stats-empty">
        <p>No putts recorded yet. Start adding some data!</p>
      </div>
    );
  }

  const stats = StatsCalculator.calculateStats(putts, unit);

  // Calculate round-based stats
  const roundStats: RoundStats[] = rounds.map((round, index) => {
    const madePutts = round.putts.filter(p => p.made);
    const totalMadeDistance = madePutts.reduce((sum, p) => sum + p.distance, 0);

    // Scale distance to 18-hole equivalent
    const scaledMadeDistance = round.holesPlayed > 0 ? (totalMadeDistance / round.holesPlayed) * 18 : totalMadeDistance;

    return {
      roundNumber: rounds.length - index,
      totalPutts: round.totalPutts,
      avgPutts: round.holesPlayed > 0 ? round.totalPutts / round.holesPlayed : 0,
      timestamp: round.timestamp,
      totalMadeDistance: scaledMadeDistance,
    };
  }).reverse();

  // Calculate last 20 rounds for putt breakdown
  const last20Rounds = rounds.slice(0, 20);

  // Helper function to count actual putts (excluding chip-ins with puttNumber === 0)
  const countActualPutts = (holePutts: PuttingAttempt[]): number => {
    // If there's a chip-in marker (puttNumber === 0), it's 0 putts
    if (holePutts.some(p => p.puttNumber === 0)) {
      return 0;
    }
    // Otherwise, count the putts
    return holePutts.length;
  };

  const chipIns = last20Rounds.reduce((sum, round) => {
    const holes = new Map<number, PuttingAttempt[]>();
    round.putts.forEach(p => {
      if (p.holeNumber !== undefined) {
        if (!holes.has(p.holeNumber)) holes.set(p.holeNumber, []);
        holes.get(p.holeNumber)!.push(p);
      }
    });
    return sum + Array.from(holes.values()).filter(h => countActualPutts(h) === 0).length;
  }, 0);

  const onePutts = last20Rounds.reduce((sum, round) => {
    const holes = new Map<number, PuttingAttempt[]>();
    round.putts.forEach(p => {
      if (p.holeNumber !== undefined) {
        if (!holes.has(p.holeNumber)) holes.set(p.holeNumber, []);
        holes.get(p.holeNumber)!.push(p);
      }
    });
    return sum + Array.from(holes.values()).filter(h => countActualPutts(h) === 1).length;
  }, 0);

  const twoPutts = last20Rounds.reduce((sum, round) => {
    const holes = new Map<number, PuttingAttempt[]>();
    round.putts.forEach(p => {
      if (p.holeNumber !== undefined) {
        if (!holes.has(p.holeNumber)) holes.set(p.holeNumber, []);
        holes.get(p.holeNumber)!.push(p);
      }
    });
    return sum + Array.from(holes.values()).filter(h => countActualPutts(h) === 2).length;
  }, 0);

  const threePlusPutts = last20Rounds.reduce((sum, round) => {
    const holes = new Map<number, PuttingAttempt[]>();
    round.putts.forEach(p => {
      if (p.holeNumber !== undefined) {
        if (!holes.has(p.holeNumber)) holes.set(p.holeNumber, []);
        holes.get(p.holeNumber)!.push(p);
      }
    });
    return sum + Array.from(holes.values()).filter(h => countActualPutts(h) >= 3).length;
  }, 0);

  const totalHoles = chipIns + onePutts + twoPutts + threePlusPutts;

  // Calculate avg putts per hole across all rounds
  const totalHolesPlayed = rounds.reduce((sum, r) => sum + r.holesPlayed, 0);
  const avgPuttsPerHole = totalHolesPlayed > 0 ? putts.length / totalHolesPlayed : 0;

  // Calculate change indicators (last 5 vs previous 5)
  const recentRounds = rounds.slice(0, 5);
  const olderRounds = rounds.slice(5, 10);
  const recentAvg = recentRounds.length > 0
    ? recentRounds.reduce((sum, r) => sum + (r.holesPlayed > 0 ? r.totalPutts / r.holesPlayed : 0), 0) / recentRounds.length
    : 0;
  const olderAvg = olderRounds.length > 0
    ? olderRounds.reduce((sum, r) => sum + (r.holesPlayed > 0 ? r.totalPutts / r.holesPlayed : 0), 0) / olderRounds.length
    : 0;
  const avgChange = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

  // Calculate median make distance
  const calculateMedian = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };

  const recentMadePutts = recentRounds.flatMap(r => r.putts?.filter(p => p.made) || []);
  const olderMadePutts = olderRounds.flatMap(r => r.putts?.filter(p => p.made) || []);
  const recentMedianMakeDist = calculateMedian(recentMadePutts.map(p => p.distance));
  const olderMedianMakeDist = calculateMedian(olderMadePutts.map(p => p.distance));
  const makeDistChange = recentMedianMakeDist - olderMedianMakeDist;

  // Calculate three-putt free streak and record streak (hole-by-hole)
  const calculateThreePuttStreaks = () => {
    // Sort all rounds by timestamp (oldest first)
    const sortedRounds = [...rounds].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let currentStreak = 0;
    let recordStreak = 0;
    let recordStreakEndDate: string | null = null;
    let tempStreak = 0;
    let tempStreakEndDate: string | null = null;
    let foundFirstThreePutt = false;

    // Work backwards from most recent round to calculate current streak
    for (let i = sortedRounds.length - 1; i >= 0; i--) {
      const round = sortedRounds[i];
      const holesMap = new Map<number, PuttingAttempt[]>();

      round.putts.forEach(p => {
        if (p.holeNumber !== undefined && p.holeNumber !== null) {
          if (!holesMap.has(p.holeNumber)) holesMap.set(p.holeNumber, []);
          holesMap.get(p.holeNumber)!.push(p);
        }
      });

      // Get sorted hole numbers (descending for backwards traversal)
      const holeNumbers = Array.from(holesMap.keys()).sort((a, b) => b - a);

      // Process holes backwards (highest to lowest)
      for (const holeNumber of holeNumbers) {
        const holePutts = holesMap.get(holeNumber)!;
        const puttCount = holePutts.filter(p => p.puttNumber !== 0).length;
        const hasThreePutt = puttCount >= 3;

        if (hasThreePutt) {
          foundFirstThreePutt = true;
          break; // Stop at first three-putt found
        } else {
          currentStreak++;
        }
      }

      if (foundFirstThreePutt) break;
    }

    // Calculate record streak by going through all rounds chronologically
    for (let i = 0; i < sortedRounds.length; i++) {
      const round = sortedRounds[i];
      const holesMap = new Map<number, PuttingAttempt[]>();

      round.putts.forEach(p => {
        if (p.holeNumber !== undefined && p.holeNumber !== null) {
          if (!holesMap.has(p.holeNumber)) holesMap.set(p.holeNumber, []);
          holesMap.get(p.holeNumber)!.push(p);
        }
      });

      // Get sorted hole numbers (ascending for forward traversal)
      const holeNumbers = Array.from(holesMap.keys()).sort((a, b) => a - b);

      // Process holes in order
      for (const holeNumber of holeNumbers) {
        const holePutts = holesMap.get(holeNumber)!;
        const puttCount = holePutts.filter(p => p.puttNumber !== 0).length;
        const hasThreePutt = puttCount >= 3;

        if (hasThreePutt) {
          // Check if this temp streak is the new record
          if (tempStreak > recordStreak) {
            recordStreak = tempStreak;
            recordStreakEndDate = round.timestamp;
          }
          tempStreak = 0;
          tempStreakEndDate = null;
        } else {
          tempStreak++;
          tempStreakEndDate = round.timestamp;
        }
      }
    }

    // Check final streak (if record streak continues to present)
    if (tempStreak > recordStreak) {
      recordStreak = tempStreak;
      recordStreakEndDate = tempStreakEndDate;
    }

    return { currentStreak, recordStreak, recordStreakEndDate };
  };

  const { currentStreak, recordStreak, recordStreakEndDate } = calculateThreePuttStreaks();

  // Last 10 rounds for trend chart
  const last10Rounds = roundStats.slice(-10);

  // Calculate median first putt distance per round
  const medianFirstPuttDistByRound = last10Rounds.map(round => {
    const roundData = rounds.find(r => r.timestamp === round.timestamp);
    if (!roundData) return { ...round, medianFirstPuttDist: 0 };

    // Group by hole and get first putt of each
    const holesMap = new Map<number, PuttingAttempt[]>();
    roundData.putts.forEach(p => {
      if (p.holeNumber !== undefined) {
        if (!holesMap.has(p.holeNumber)) holesMap.set(p.holeNumber, []);
        holesMap.get(p.holeNumber)!.push(p);
      }
    });

    const firstPuttDistances: number[] = [];
    holesMap.forEach(holePutts => {
      const sorted = holePutts.sort((a, b) => (a.puttNumber || 0) - (b.puttNumber || 0));
      const firstPutt = sorted[0];
      if (firstPutt && firstPutt.puttNumber !== 0) {
        firstPuttDistances.push(firstPutt.distance);
      }
    });

    const median = calculateMedian(firstPuttDistances);
    return { ...round, medianFirstPuttDist: median };
  });

  // Calculate make probability by distance
  const distanceRanges = [
    { label: '0m — 1m', min: 0, max: 1 },
    { label: '1m — 2m', min: 1, max: 2 },
    { label: '2m — 3m', min: 2, max: 3 },
    { label: '3m — 4m', min: 3, max: 4 },
    { label: '4m — 5m', min: 4, max: 5 },
    { label: '5m — 6m', min: 5, max: 6 },
    { label: '6m +', min: 6, max: Infinity },
  ];

  const makeProbability = distanceRanges.map(range => {
    const puttsInRange = putts.filter(p => {
      const inRange = p.distance >= range.min && p.distance < range.max;
      const isFirstPutt = !showFirstPuttsOnly || (p.puttNumber === 1);
      return inRange && isFirstPutt;
    });
    const made = puttsInRange.filter(p => p.made).length;
    const total = puttsInRange.length;
    return {
      label: range.label,
      percentage: total > 0 ? (made / total) * 100 : 0,
      made,
      total,
    };
  });

  // Calculate three-putt probability by distance (first putt only)
  // Using different ranges for three-putt analysis
  const threePuttRanges = [
    { label: '0m — 5m', min: 0, max: 5 },
    { label: '5m — 10m', min: 5, max: 10 },
    { label: '10m — 15m', min: 10, max: 15 },
    { label: '15m +', min: 15, max: Infinity },
  ];

  const threePuttProbability = threePuttRanges.map(range => {
    // Group putts by unique hole (roundId × hole number)
    const holesMap = new Map<string, PuttingAttempt[]>();
    putts.forEach(p => {
      if (p.holeNumber !== undefined && p.roundId) {
        // Create unique key: roundId × hole number
        const holeKey = `${p.roundId}_${p.holeNumber}`;
        if (!holesMap.has(holeKey)) holesMap.set(holeKey, []);
        holesMap.get(holeKey)!.push(p);
      }
    });

    // For each unique hole, get the first putt and check if it's in range
    const firstPuttsInRange = Array.from(holesMap.entries())
      .map(([holeKey, holePutts]) => {
        const sortedPutts = holePutts.sort((a, b) => (a.puttNumber || 0) - (b.puttNumber || 0));
        return { holeKey, firstPutt: sortedPutts[0], totalPutts: sortedPutts.length };
      })
      .filter(h => h.firstPutt.distance >= range.min && h.firstPutt.distance < range.max);

    // Count how many holes in range had 3+ putts
    const threePutts = firstPuttsInRange.filter(h => h.totalPutts >= 3).length;

    const total = firstPuttsInRange.length;
    return {
      label: range.label,
      percentage: total > 0 ? (threePutts / total) * 100 : 0,
      threePutts,
      total,
    };
  });

  // Calculate average leave distance for missed putts (lag putting performance)
  const lagRanges = [
    { label: '0m — 5m', min: 0, max: 5 },
    { label: '5m — 10m', min: 5, max: 10 },
    { label: '10m — 15m', min: 10, max: 15 },
    { label: '15m +', min: 15, max: Infinity },
  ];

  // Use last 10 rounds for lag analysis
  const last10RoundsPutts = last10Rounds.flatMap(r =>
    rounds.find(round => round.timestamp === r.timestamp)?.putts || []
  );

  const avgLeaveDistance = lagRanges.map(range => {
    // Group putts by hole to find next putt after a miss
    // Use timestamp as fallback if roundId not available
    const holesMap = new Map<string, PuttingAttempt[]>();

    last10Rounds.forEach((round, roundIndex) => {
      const roundPutts = rounds.find(r => r.timestamp === round.timestamp)?.putts || [];

      roundPutts.forEach(p => {
        if (p.holeNumber !== undefined) {
          const holeKey = `round${roundIndex}_hole${p.holeNumber}`;
          if (!holesMap.has(holeKey)) holesMap.set(holeKey, []);
          holesMap.get(holeKey)!.push(p);
        }
      });
    });

    const leaveDist: number[] = [];

    holesMap.forEach(holePutts => {
      const sortedPutts = holePutts.sort((a, b) => (a.puttNumber || 0) - (b.puttNumber || 0));

      sortedPutts.forEach((putt, index) => {
        // Check if this putt is a miss in our range
        if (!putt.made && putt.distance >= range.min && putt.distance < range.max) {
          // Find the next putt on this hole
          const nextPutt = sortedPutts[index + 1];
          if (nextPutt) {
            // The next putt's distance is the leave distance
            leaveDist.push(nextPutt.distance);
          }
        }
      });
    });

    const avgLeave = leaveDist.length > 0
      ? leaveDist.reduce((sum, d) => sum + d, 0) / leaveDist.length
      : 0;

    return {
      label: range.label,
      avgLeave,
      count: leaveDist.length,
    };
  });

  // Calculate miss direction breakdown
  // Only use putts that have missDirection stored (no proximity fallback)
  // Filter by distance: all, short (<3m), medium (3-8m), or long (>8m)
  const missedPuttsWithDirection = putts.filter(p => {
    if (p.made || !p.missDirection) return false;

    if (missDistanceFilter === 'all') {
      return true;
    } else if (missDistanceFilter === 'short') {
      return p.distance < 3;
    } else if (missDistanceFilter === 'medium') {
      return p.distance >= 3 && p.distance <= 8;
    } else {
      return p.distance > 8;
    }
  });

  const missDirections = {
    short: missedPuttsWithDirection.filter(p => p.missDirection === 'short').length,
    long: missedPuttsWithDirection.filter(p => p.missDirection === 'long').length,
    left: missedPuttsWithDirection.filter(p => p.missDirection === 'left').length,
    right: missedPuttsWithDirection.filter(p => p.missDirection === 'right').length,
  };
  const totalMisses = missedPuttsWithDirection.length;
  const missPercentages = {
    short: totalMisses > 0 ? (missDirections.short / totalMisses) * 100 : 0,
    long: totalMisses > 0 ? (missDirections.long / totalMisses) * 100 : 0,
    left: totalMisses > 0 ? (missDirections.left / totalMisses) * 100 : 0,
    right: totalMisses > 0 ? (missDirections.right / totalMisses) * 100 : 0,
  };

  return (
    <div className="stats-display-modern">
      {/* Top Summary Cards - Row 1 */}
      <div className="stats-summary-cards">
        <div className="stats-summary-card">
          <div className="stats-summary-label">ROUNDS</div>
          <div className="stats-summary-value">{rounds.length}</div>
          {rounds.length > 10 && (
            <div className="stats-summary-change positive">+{rounds.length - 10}</div>
          )}
        </div>
        <div className="stats-summary-card">
          <div className="stats-summary-label">AVG PUTTS</div>
          <div className="stats-summary-value">{(avgPuttsPerHole * 18).toFixed(1)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            {avgPuttsPerHole.toFixed(2)} per hole
          </div>
          {avgChange !== 0 && (
            <div className={`stats-summary-change ${avgChange < 0 ? 'positive' : 'negative'}`}>
              {avgChange > 0 ? '↗' : '↘'} {Math.abs(avgChange).toFixed(0)}%
            </div>
          )}
        </div>
      </div>

      {/* Top Summary Cards - Row 2 */}
      <div className="stats-summary-cards">
        <div className="stats-summary-card">
          <div className="stats-summary-label">MEDIAN MAKE DISTANCE</div>
          <div className="stats-summary-value">{recentMedianMakeDist.toFixed(1)}m</div>
          {makeDistChange !== 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {makeDistChange > 0 ? '▲' : '▼'} {makeDistChange > 0 ? '+' : ''}{makeDistChange.toFixed(1)}m
            </div>
          )}
        </div>
        <div className="stats-summary-card">
          <div className="stats-summary-label">3-PUTT FREE STREAK</div>
          <div className="stats-summary-value">
            {currentStreak} hole{currentStreak !== 1 ? 's' : ''}
          </div>
          {recordStreak > 0 && recordStreak !== currentStreak && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {currentStreak > 0 ? 'Previous record' : 'Record'}: {recordStreak} hole{recordStreak !== 1 ? 's' : ''}
              {recordStreakEndDate && (
                <span> ({new Date(recordStreakEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Putt Breakdown */}
      <div className="stats-section-modern">
        <div className="stats-section-header">
          <h3>Putt Breakdown</h3>
          <span className="stats-section-subtitle">Last 20 Rounds</span>
        </div>
        <div style={{ position: 'relative' }}>
          <div className="putt-breakdown-bar">
            {/* Always show chip-in segment with minimum 0.8% width (≈4px) */}
            {(() => {
              const actualPercentage = (chipIns / totalHoles) * 100;
              const displayWidth = Math.max(0.8, actualPercentage);
              const displayLabel = actualPercentage < 0.1 ? '<0.1%' : `${Math.round(actualPercentage)}%`;
              // Show label outside if segment is less than 5% (too narrow to read inside)
              const showLabelOutside = displayWidth < 5;

              return (
                <>
                  <div
                    className="putt-breakdown-segment chip-in"
                    style={{ width: `${displayWidth}%` }}
                  >
                    {!showLabelOutside && <span className="putt-breakdown-label">{displayLabel}</span>}
                  </div>
                  {showLabelOutside && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '0',
                        top: '100%',
                        fontSize: '0.75rem',
                        color: '#8b5cf6',
                        marginTop: '0.25rem',
                        fontWeight: '600',
                      }}
                    >
                      {displayLabel}
                    </div>
                  )}
                </>
              );
            })()}
          {onePutts > 0 && (
            <div
              className="putt-breakdown-segment one-putt"
              style={{ width: `${(onePutts / totalHoles) * 100}%` }}
            >
              <span className="putt-breakdown-label">{Math.round((onePutts / totalHoles) * 100)}%</span>
            </div>
          )}
          {twoPutts > 0 && (
            <div
              className="putt-breakdown-segment two-putts"
              style={{ width: `${(twoPutts / totalHoles) * 100}%` }}
            >
              <span className="putt-breakdown-label">{Math.round((twoPutts / totalHoles) * 100)}%</span>
            </div>
          )}
          {threePlusPutts > 0 && (
            <div
              className="putt-breakdown-segment three-plus-putts"
              style={{ width: `${(threePlusPutts / totalHoles) * 100}%` }}
            >
              <span className="putt-breakdown-label">{Math.round((threePlusPutts / totalHoles) * 100)}%</span>
            </div>
          )}
          </div>
        </div>
        <div className="putt-breakdown-legend">
          <div className="putt-breakdown-legend-item">
            <div className="putt-breakdown-legend-dot chip-in"></div>
            <span>0 Putts</span>
          </div>
          <div className="putt-breakdown-legend-item">
            <div className="putt-breakdown-legend-dot one-putt"></div>
            <span>1 Putt</span>
          </div>
          <div className="putt-breakdown-legend-item">
            <div className="putt-breakdown-legend-dot two-putts"></div>
            <span>2 Putts</span>
          </div>
          <div className="putt-breakdown-legend-item">
            <div className="putt-breakdown-legend-dot three-plus-putts"></div>
            <span>3+ Putts</span>
          </div>
        </div>
      </div>

      {/* Make Probability */}
      <div className="stats-section-modern">
        <div className="stats-section-header">
          <h3>Make Probability</h3>
          <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem' }}>
            <button
              onClick={() => setShowFirstPuttsOnly(false)}
              style={{
                padding: '0.25rem 0.75rem',
                background: !showFirstPuttsOnly ? 'rgba(74, 222, 128, 0.2)' : 'transparent',
                color: !showFirstPuttsOnly ? '#4ade80' : 'var(--color-text-secondary)',
                border: '1px solid',
                borderColor: !showFirstPuttsOnly ? '#4ade80' : 'var(--color-border)',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              All Putts
            </button>
            <button
              onClick={() => setShowFirstPuttsOnly(true)}
              style={{
                padding: '0.25rem 0.75rem',
                background: showFirstPuttsOnly ? 'rgba(74, 222, 128, 0.2)' : 'transparent',
                color: showFirstPuttsOnly ? '#4ade80' : 'var(--color-text-secondary)',
                border: '1px solid',
                borderColor: showFirstPuttsOnly ? '#4ade80' : 'var(--color-border)',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              First Putts
            </button>
          </div>
        </div>
        <div className="make-probability-list">
          {makeProbability.map((item, index) => (
            <div key={index} className="make-probability-row">
              <div className="make-probability-label">{item.label}</div>
              <div className="make-probability-bar-container">
                <div
                  className="make-probability-bar"
                  style={{ width: `${item.percentage}%` }}
                ></div>
              </div>
              <div className="make-probability-percentage">
                {item.percentage.toFixed(0)}% {item.total > 0 && `(${item.made}/${item.total})`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Three-Putt Probability */}
      <div className="stats-section-modern">
        <h3>Three-Putt Probability</h3>
        <div className="make-probability-list">
          {threePuttProbability.map((item, index) => (
            <div key={index} className="make-probability-row">
              <div className="make-probability-label">{item.label}</div>
              <div className="make-probability-bar-container">
                <div
                  className="make-probability-bar"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: '#ef4444'
                  }}
                ></div>
              </div>
              <div className="make-probability-percentage">
                {item.percentage.toFixed(1)}% {item.total > 0 && `(${item.threePutts}/${item.total})`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Average Leave Distance */}
      {avgLeaveDistance.some(item => item.count > 0) && (
        <div className="stats-section-modern">
          <div className="stats-section-header">
            <h3>Average Leave Distance</h3>
            <span className="stats-section-subtitle">Last 10 Rounds</span>
          </div>
          <div className="make-probability-list">
            {avgLeaveDistance.map((item, index) => {
              const maxLeave = Math.max(...avgLeaveDistance.map(i => i.avgLeave));
              const relativeWidth = maxLeave > 0 ? (item.avgLeave / maxLeave) * 100 : 0;

              return (
                <div key={index} className="make-probability-row">
                  <div className="make-probability-label">{item.label}</div>
                  <div className="make-probability-bar-container">
                    {item.count > 0 && (
                      <div
                        className="make-probability-bar"
                        style={{
                          width: `${relativeWidth}%`,
                          backgroundColor: 'rgba(74, 222, 128, 0.4)'
                        }}
                      ></div>
                    )}
                  </div>
                  <div className="make-probability-percentage">
                    {item.count > 0 ? `${item.avgLeave.toFixed(1)}m` : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Average Putts Trend */}
      {last10Rounds.length > 0 && (
        <div className="stats-section-modern">
          <div className="stats-section-header">
            <h3>Average Putts</h3>
            <span className="stats-section-subtitle">Last 10 Rounds</span>
          </div>
          <div className="trend-chart" style={{ position: 'relative' }}>
            <svg width="100%" height="260" viewBox="-30 0 560 260" preserveAspectRatio="none">
              <defs>
                <linearGradient id="avgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(74, 222, 128, 0.3)" />
                  <stop offset="100%" stopColor="rgba(74, 222, 128, 0)" />
                </linearGradient>
              </defs>
              {/* Area under curve */}
              <path
                d={generateAreaPath(last10Rounds.map(r => r.avgPutts), 200)}
                fill="url(#avgGradient)"
              />
              {/* Line */}
              <path
                d={generateLinePath(last10Rounds.map(r => r.avgPutts), 200)}
                fill="none"
                stroke="#4ade80"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Data points with values */}
              {last10Rounds.map((round, index) => {
                const min = Math.min(...last10Rounds.map(r => r.avgPutts));
                const max = Math.max(...last10Rounds.map(r => r.avgPutts));
                const range = max - min || 1;
                const x = last10Rounds.length > 1 ? index * (500 / (last10Rounds.length - 1)) : 250;
                const y = 200 - ((round.avgPutts - min + 0.5) / (range + 1)) * 160;

                return (
                  <g key={index}>
                    <circle
                      cx={x}
                      cy={y}
                      r="4"
                      fill="white"
                      stroke="#4ade80"
                      strokeWidth="2"
                    />
                    <text
                      x={x}
                      y={y - 12}
                      textAnchor="middle"
                      fill="rgba(255, 255, 255, 0.7)"
                      fontSize="11"
                      fontWeight="500"
                    >
                      {round.avgPutts.toFixed(1)}
                    </text>
                  </g>
                );
              })}
              {/* Date labels at bottom */}
              {last10Rounds.map((round, index) => {
                const x = last10Rounds.length > 1 ? index * (500 / (last10Rounds.length - 1)) : 250;
                const showDate = index === 0 || index === last10Rounds.length - 1;

                if (!showDate) return null;

                const date = new Date(round.timestamp);
                const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;

                return (
                  <text
                    key={`date-${index}`}
                    x={x}
                    y={235}
                    textAnchor="middle"
                    fill="rgba(255, 255, 255, 0.5)"
                    fontSize="10"
                  >
                    {dateStr}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Total Distance Made Trend */}
      {last10Rounds.length > 0 && (
        <div className="stats-section-modern">
          <div className="stats-section-header">
            <h3>Total Distance Made</h3>
            <span className="stats-section-subtitle">Last 10 Rounds</span>
          </div>
          <div className="trend-chart" style={{ position: 'relative' }}>
            <svg width="100%" height="260" viewBox="-30 0 560 260" preserveAspectRatio="none">
              <defs>
                <linearGradient id="distGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(139, 92, 246, 0.3)" />
                  <stop offset="100%" stopColor="rgba(139, 92, 246, 0)" />
                </linearGradient>
              </defs>
              {/* Area under curve */}
              <path
                d={generateAreaPath(last10Rounds.map(r => r.totalMadeDistance), 200)}
                fill="url(#distGradient)"
              />
              {/* Line */}
              <path
                d={generateLinePath(last10Rounds.map(r => r.totalMadeDistance), 200)}
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Data points with values */}
              {last10Rounds.map((round, index) => {
                const min = Math.min(...last10Rounds.map(r => r.totalMadeDistance));
                const max = Math.max(...last10Rounds.map(r => r.totalMadeDistance));
                const range = max - min || 1;
                const x = last10Rounds.length > 1 ? index * (500 / (last10Rounds.length - 1)) : 250;
                const y = 200 - ((round.totalMadeDistance - min + 0.5) / (range + 1)) * 160;

                return (
                  <g key={index}>
                    <circle
                      cx={x}
                      cy={y}
                      r="4"
                      fill="white"
                      stroke="#8b5cf6"
                      strokeWidth="2"
                    />
                    <text
                      x={x}
                      y={y - 12}
                      textAnchor="middle"
                      fill="rgba(255, 255, 255, 0.7)"
                      fontSize="11"
                      fontWeight="500"
                    >
                      {round.totalMadeDistance.toFixed(0)}m
                    </text>
                  </g>
                );
              })}
              {/* Date labels at bottom */}
              {last10Rounds.map((round, index) => {
                const x = last10Rounds.length > 1 ? index * (500 / (last10Rounds.length - 1)) : 250;
                const showDate = index === 0 || index === last10Rounds.length - 1;

                if (!showDate) return null;

                const date = new Date(round.timestamp);
                const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;

                return (
                  <text
                    key={`date-${index}`}
                    x={x}
                    y={235}
                    textAnchor="middle"
                    fill="rgba(255, 255, 255, 0.5)"
                    fontSize="10"
                  >
                    {dateStr}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Miss Direction Breakdown */}
      {totalMisses > 0 && (
        <div className="stats-section-modern">
          <div className="stats-section-header">
            <h3>Miss Direction</h3>
            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem' }}>
              <button
                onClick={() => setMissDistanceFilter('all')}
                style={{
                  padding: '0.25rem 0.75rem',
                  background: missDistanceFilter === 'all' ? 'rgba(74, 222, 128, 0.2)' : 'transparent',
                  color: missDistanceFilter === 'all' ? '#4ade80' : 'var(--color-text-secondary)',
                  border: '1px solid',
                  borderColor: missDistanceFilter === 'all' ? '#4ade80' : 'var(--color-border)',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                All
              </button>
              <button
                onClick={() => setMissDistanceFilter('short')}
                style={{
                  padding: '0.25rem 0.75rem',
                  background: missDistanceFilter === 'short' ? 'rgba(74, 222, 128, 0.2)' : 'transparent',
                  color: missDistanceFilter === 'short' ? '#4ade80' : 'var(--color-text-secondary)',
                  border: '1px solid',
                  borderColor: missDistanceFilter === 'short' ? '#4ade80' : 'var(--color-border)',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                &lt; 3m
              </button>
              <button
                onClick={() => setMissDistanceFilter('medium')}
                style={{
                  padding: '0.25rem 0.75rem',
                  background: missDistanceFilter === 'medium' ? 'rgba(74, 222, 128, 0.2)' : 'transparent',
                  color: missDistanceFilter === 'medium' ? '#4ade80' : 'var(--color-text-secondary)',
                  border: '1px solid',
                  borderColor: missDistanceFilter === 'medium' ? '#4ade80' : 'var(--color-border)',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                3m — 8m
              </button>
              <button
                onClick={() => setMissDistanceFilter('long')}
                style={{
                  padding: '0.25rem 0.75rem',
                  background: missDistanceFilter === 'long' ? 'rgba(74, 222, 128, 0.2)' : 'transparent',
                  color: missDistanceFilter === 'long' ? '#4ade80' : 'var(--color-text-secondary)',
                  border: '1px solid',
                  borderColor: missDistanceFilter === 'long' ? '#4ade80' : 'var(--color-border)',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                &gt; 8m
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', padding: '1rem 0' }}>
            {/* Donut Chart */}
            <svg width="180" height="180" viewBox="0 0 180 180">
              <defs>
                <filter id="shadow">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
                </filter>
              </defs>
              {(() => {
                const radius = 70;
                const innerRadius = 45;
                const centerX = 90;
                const centerY = 90;

                const segments = [
                  { color: '#ef4444', percentage: missPercentages.short, label: 'Short' },
                  { color: '#f97316', percentage: missPercentages.long, label: 'Long' },
                  { color: '#3b82f6', percentage: missPercentages.left, label: 'Left' },
                  { color: '#8b5cf6', percentage: missPercentages.right, label: 'Right' },
                ];

                let currentAngle = -90; // Start at top

                return segments.map((segment, index) => {
                  if (segment.percentage === 0) return null;

                  const angle = (segment.percentage / 100) * 360;
                  const startAngle = currentAngle;
                  const endAngle = currentAngle + angle;

                  // Convert to radians
                  const startRad = (startAngle * Math.PI) / 180;
                  const endRad = (endAngle * Math.PI) / 180;

                  // Calculate outer arc points
                  const x1 = centerX + radius * Math.cos(startRad);
                  const y1 = centerY + radius * Math.sin(startRad);
                  const x2 = centerX + radius * Math.cos(endRad);
                  const y2 = centerY + radius * Math.sin(endRad);

                  // Calculate inner arc points
                  const x3 = centerX + innerRadius * Math.cos(endRad);
                  const y3 = centerY + innerRadius * Math.sin(endRad);
                  const x4 = centerX + innerRadius * Math.cos(startRad);
                  const y4 = centerY + innerRadius * Math.sin(startRad);

                  const largeArc = angle > 180 ? 1 : 0;

                  const path = `
                    M ${x1} ${y1}
                    A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
                    L ${x3} ${y3}
                    A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
                    Z
                  `;

                  currentAngle = endAngle;

                  return (
                    <path
                      key={index}
                      d={path}
                      fill={segment.color}
                      filter="url(#shadow)"
                    />
                  );
                });
              })()}
              {/* Center circle */}
              <circle cx="90" cy="90" r="45" fill="var(--color-background)" />
              {/* Center text */}
              <text x="90" y="85" textAnchor="middle" fill="var(--color-text)" fontSize="24" fontWeight="bold">
                {totalMisses}
              </text>
              <text x="90" y="102" textAnchor="middle" fill="var(--color-text-secondary)" fontSize="12">
                Misses
              </text>
            </svg>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>
                  Short {missPercentages.short.toFixed(0)}% ({missDirections.short})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f97316' }}></div>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>
                  Long {missPercentages.long.toFixed(0)}% ({missDirections.long})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>
                  Left {missPercentages.left.toFixed(0)}% ({missDirections.left})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#8b5cf6' }}></div>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>
                  Right {missPercentages.right.toFixed(0)}% ({missDirections.right})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Median First Putt Distance */}
      {medianFirstPuttDistByRound.length > 0 && (
        <div className="stats-section-modern">
          <div className="stats-section-header">
            <h3>Median First Putt Distance</h3>
            <span className="stats-section-subtitle">Last 10 Rounds</span>
          </div>
          <div className="trend-chart" style={{ position: 'relative' }}>
            <svg width="100%" height="260" viewBox="-30 0 560 260" preserveAspectRatio="none">
              <defs>
                <linearGradient id="medianFirstPuttGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(59, 130, 246, 0.3)" />
                  <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
                </linearGradient>
              </defs>
              {/* Area under curve */}
              <path
                d={generateAreaPath(medianFirstPuttDistByRound.map(r => r.medianFirstPuttDist), 200)}
                fill="url(#medianFirstPuttGradient)"
              />
              {/* Line */}
              <path
                d={generateLinePath(medianFirstPuttDistByRound.map(r => r.medianFirstPuttDist), 200)}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Data points with values */}
              {medianFirstPuttDistByRound.map((round, index) => {
                const min = Math.min(...medianFirstPuttDistByRound.map(r => r.medianFirstPuttDist));
                const max = Math.max(...medianFirstPuttDistByRound.map(r => r.medianFirstPuttDist));
                const range = max - min || 1;
                const x = medianFirstPuttDistByRound.length > 1 ? index * (500 / (medianFirstPuttDistByRound.length - 1)) : 250;
                const y = 200 - ((round.medianFirstPuttDist - min + 0.5) / (range + 1)) * 160;

                return (
                  <g key={index}>
                    <circle
                      cx={x}
                      cy={y}
                      r="4"
                      fill="white"
                      stroke="#3b82f6"
                      strokeWidth="2"
                    />
                    <text
                      x={x}
                      y={y - 12}
                      textAnchor="middle"
                      fill="rgba(255, 255, 255, 0.7)"
                      fontSize="11"
                      fontWeight="500"
                    >
                      {round.medianFirstPuttDist.toFixed(1)}m
                    </text>
                  </g>
                );
              })}
              {/* Date labels at bottom */}
              {medianFirstPuttDistByRound.map((round, index) => {
                const x = medianFirstPuttDistByRound.length > 1 ? index * (500 / (medianFirstPuttDistByRound.length - 1)) : 250;
                const showDate = index === 0 || index === medianFirstPuttDistByRound.length - 1;

                if (!showDate) return null;

                const date = new Date(round.timestamp);
                const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;

                return (
                  <text
                    key={`date-${index}`}
                    x={x}
                    y="230"
                    textAnchor="middle"
                    fill="rgba(255, 255, 255, 0.5)"
                    fontSize="11"
                  >
                    {dateStr}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>
      )}

    </div>
  );
}

// Helper function to generate SVG path for line chart
function generateLinePath(values: number[], height: number = 200): string {
  if (values.length === 0) return '';

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = height === 200 ? 0.5 : 0.2;

  const points = values.map((value, index) => {
    const x = index * (500 / (values.length - 1 || 1));
    const y = height - ((value - min + padding) / (range + padding * 2)) * (height - 40);
    return `${x},${y}`;
  });

  return `M ${points.join(' L ')}`;
}

// Helper function to generate SVG path for area chart
function generateAreaPath(values: number[], height: number = 200): string {
  if (values.length === 0) return '';

  const linePath = generateLinePath(values, height);
  const lastX = (values.length - 1) * (500 / (values.length - 1 || 1));

  return `${linePath} L ${lastX},${height} L 0,${height} Z`;
}

// Helper function to calculate average first putt distance
function calculateAvgFirstPuttDistance(putts: PuttingAttempt[]): number {
  const holes = new Map<number, PuttingAttempt[]>();

  putts.forEach(p => {
    if (p.holeNumber !== undefined) {
      if (!holes.has(p.holeNumber)) holes.set(p.holeNumber, []);
      holes.get(p.holeNumber)!.push(p);
    }
  });

  const firstPutts = Array.from(holes.values())
    .map(holePutts => holePutts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0]);

  if (firstPutts.length === 0) return 0;

  return firstPutts.reduce((sum, p) => sum + p.distance, 0) / firstPutts.length;
}

// Helper function to calculate average make distance
function calculateAvgMakeDistance(putts: PuttingAttempt[]): number {
  const madePutts = putts.filter(p => p.made);

  if (madePutts.length === 0) return 0;

  return madePutts.reduce((sum, p) => sum + p.distance, 0) / madePutts.length;
}

// Helper function to calculate total distance of made putts
