'use client';

import { useState, useEffect } from 'react';
import { PuttingAttempt } from '@/types';
import { Check, Edit3, Award, CircleX, RedoDot, Ruler, Crosshair, UnfoldVertical, Target, Star } from 'lucide-react';
import { RoundHistory, SavedRound } from '@/lib/roundHistory';

interface RoundSummaryProps {
  putts: PuttingAttempt[];
  courseName: string;
  date: Date;
  onDone: () => void;
  onEditMetadata?: (courseName: string, date: Date) => void;
  onEditHole?: (holeNumber: number) => void;
  onViewHole?: (holeNumber: number) => void; // Callback to view a hole (read-only)
  onAddHole?: (holeNumber: number) => void; // Callback to add a new hole
  isHistorical?: boolean; // Whether viewing a saved round from history
}

interface HoleSummary {
  hole: number;
  puttCount: number;
  putts: PuttingAttempt[];
  holedDistance: number;
}

interface ComparisonMetrics {
  totalPutts: { current: number; avg: number; delta: number };
  totalPutts18: { current: number; avg: number; delta: number };
  avgPerHole: { current: number; avg: number; delta: number };
  totalMakeDist: { current: number; avg: number; delta: number };
  onePutts: { current: number; avg: number; delta: number };
  twoPutts: { current: number; avg: number; delta: number };
  threePutts: { current: number; avg: number; delta: number };
}

export function RoundSummary({ putts, courseName, date, onDone, onEditMetadata, onEditHole, onViewHole, onAddHole, isHistorical = false }: RoundSummaryProps) {
  const [editCourseName, setEditCourseName] = useState(courseName);
  const [editDate, setEditDate] = useState(date);
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); // Master edit mode toggle
  const [last5Rounds, setLast5Rounds] = useState<SavedRound[]>([]);
  const [courseRounds, setCourseRounds] = useState<SavedRound[]>([]);

  // Fetch last 5 rounds for comparison
  useEffect(() => {
    const fetchRecentRounds = async () => {
      const allRounds = await RoundHistory.getRounds();
      // Get last 5 rounds, excluding current round if it exists in history
      const recentRounds = allRounds
        .filter(r => new Date(r.timestamp).getTime() !== date.getTime())
        .slice(0, 5);
      setLast5Rounds(recentRounds);

      // Get all rounds for this course (excluding current round)
      const sameCourseRounds = allRounds
        .filter(r => r.course === courseName && new Date(r.timestamp).getTime() !== date.getTime());
      setCourseRounds(sameCourseRounds);
    };
    fetchRecentRounds();
  }, [date, courseName]);

  // Sync props with local state when they change
  useEffect(() => {
    setEditCourseName(courseName);
  }, [courseName]);

  useEffect(() => {
    setEditDate(date);
  }, [date]);

  // Calculate statistics
  const holesPlayed = new Set(putts.map(p => p.holeNumber).filter(h => h !== undefined)).size;

  // Helper function to count actual putts (excluding chip-ins with puttNumber === 0 or distance === 0 and made === true)
  const countActualPutts = (holePutts: PuttingAttempt[]): number => {
    // Check for chip-in marker (puttNumber === 0)
    if (holePutts.some(p => p.puttNumber === 0)) {
      return 0;
    }
    // Also check for old-style chip-ins (single made putt with distance 0)
    if (holePutts.length === 1 && holePutts[0].made && holePutts[0].distance === 0) {
      return 0;
    }
    // Otherwise, count the putts
    return holePutts.length;
  };

  // Helper function to build putt sequence string
  const buildPuttSequence = (holePutts: PuttingAttempt[]): string => {
    // Check for chip-in
    if (holePutts.some(p => p.puttNumber === 0) ||
        (holePutts.length === 1 && holePutts[0].made && holePutts[0].distance === 0)) {
      return 'Chipped in';
    }

    // Sort putts by putt number
    const sortedPutts = [...holePutts].sort((a, b) => (a.puttNumber || 0) - (b.puttNumber || 0));

    // Extract distances and format to 1 decimal place
    const distances = sortedPutts.map(p => `${p.distance.toFixed(1)}m`);

    // Join with arrow
    return distances.join(' → ');
  };

  // Key signal type definition
  type KeySignal =
    | { type: 'long-make'; distance: number }
    | { type: 'short-miss'; distance: number }
    | { type: 'missed-opportunity'; distance: number }
    | { type: 'critical-make'; distance: number }
    | { type: 'nice-bonus'; distance: number }
    | { type: 'poor-speed'; startDistance: number; endDistance: number }
    | { type: 'great-lag'; firstPuttDistance: number; endProximity: number }
    | { type: 'great-approach'; distance: number };

  // Helper function to detect key signals for a hole
  const detectKeySignal = (holePutts: PuttingAttempt[]): KeySignal | null => {
    if (holePutts.length === 0) return null;

    // Check for chip-ins - these don't get signals
    const isChipIn = holePutts.some(p => p.puttNumber === 0) ||
                     (holePutts.length === 1 && holePutts[0].made && holePutts[0].distance === 0);
    if (isChipIn) return null;

    // Sort putts by putt number to identify first putt
    const sortedPutts = [...holePutts].sort((a, b) => (a.puttNumber || 0) - (b.puttNumber || 0));
    const firstPutt = sortedPutts[0];

    // Priority 1: Long make (≥ 6m)
    const longMakes = holePutts.filter(p => p.made && p.distance >= 6);
    if (longMakes.length > 0) {
      const longest = longMakes.reduce((max, p) => p.distance > max.distance ? p : max);
      return { type: 'long-make', distance: longest.distance };
    }

    // Priority 2: Short miss (< 1.5m)
    const shortMiss = holePutts.find(p => !p.made && p.distance < 1.5);
    if (shortMiss) {
      return { type: 'short-miss', distance: shortMiss.distance };
    }

    // Priority 3: Missed opportunity (missed putt 1.5–3m)
    const missedOpp = holePutts.find(p => !p.made && p.distance >= 1.5 && p.distance <= 3);
    if (missedOpp) {
      return { type: 'missed-opportunity', distance: missedOpp.distance };
    }

    // Priority 4: Critical make (made putt 1.5–3m)
    const criticalMakes = holePutts.filter(p => p.made && p.distance >= 1.5 && p.distance <= 3);
    if (criticalMakes.length > 0) {
      const longest = criticalMakes.reduce((max, p) => p.distance > max.distance ? p : max);
      return { type: 'critical-make', distance: longest.distance };
    }

    // Priority 5: Nice bonus (made putt 3–6m)
    const niceBonusMakes = holePutts.filter(p => p.made && p.distance > 3 && p.distance < 6);
    if (niceBonusMakes.length > 0) {
      const longest = niceBonusMakes.reduce((max, p) => p.distance > max.distance ? p : max);
      return { type: 'nice-bonus', distance: longest.distance };
    }

    // Priority 6: Poor speed (first putt ≥ 10m, left > 3m)
    if (firstPutt && firstPutt.distance >= 10 && !firstPutt.made && sortedPutts.length >= 2) {
      const secondPutt = sortedPutts[1];
      if (secondPutt && secondPutt.distance > 3) {
        return { type: 'poor-speed', startDistance: firstPutt.distance, endDistance: secondPutt.distance };
      }
    }

    // Priority 7: Great lag (first putt ≥ 15m, left < 2m)
    if (firstPutt && firstPutt.distance >= 15 && !firstPutt.made && sortedPutts.length >= 2) {
      const secondPutt = sortedPutts[1];
      if (secondPutt && secondPutt.distance < 2) {
        return { type: 'great-lag', firstPuttDistance: firstPutt.distance, endProximity: secondPutt.distance };
      }
    }

    // Priority 8: Great approach (first putt ≤ 1m - tap-in range)
    if (firstPutt && firstPutt.distance <= 1) {
      return { type: 'great-approach', distance: firstPutt.distance };
    }

    // No signals apply
    return null;
  };

  // Helper function to get signal label text
  const getSignalLabel = (signal: KeySignal): string => {
    switch (signal.type) {
      case 'long-make':
        return 'Long make';
      case 'short-miss':
        return 'Short miss';
      case 'critical-make':
        return 'Critical make';
      case 'nice-bonus':
        return 'Nice bonus';
      case 'poor-speed':
        return 'Poor speed';
      case 'missed-opportunity':
        return 'Missed opp';
      case 'great-lag':
        return 'Great lag';
      case 'great-approach':
        return 'Great approach';
    }
  };

  // Helper function to calculate average putts for a specific hole across previous rounds
  const getHoleAverage = (holeNumber: number): number | null => {
    if (courseRounds.length < 2) return null; // Need at least 2 previous rounds

    const holePuttCounts: number[] = [];

    courseRounds.forEach(round => {
      // Group putts by hole for this round
      const holeMap = new Map<number, PuttingAttempt[]>();
      round.putts?.forEach(p => {
        if (p.holeNumber !== undefined) {
          if (!holeMap.has(p.holeNumber)) {
            holeMap.set(p.holeNumber, []);
          }
          holeMap.get(p.holeNumber)!.push(p);
        }
      });

      // Get putts for the specific hole
      const holePutts = holeMap.get(holeNumber);
      if (holePutts) {
        const count = countActualPutts(holePutts);
        holePuttCounts.push(count);
      }
    });

    if (holePuttCounts.length === 0) return null;

    const average = holePuttCounts.reduce((sum, count) => sum + count, 0) / holePuttCounts.length;
    return average;
  };

  // Count putts by type (1-putt, 2-putt, 3+) - need to do this early to calculate total putts
  const holeGroups = new Map<number, PuttingAttempt[]>();
  putts.forEach(p => {
    if (p.holeNumber !== undefined) {
      if (!holeGroups.has(p.holeNumber)) {
        holeGroups.set(p.holeNumber, []);
      }
      holeGroups.get(p.holeNumber)!.push(p);
    }
  });

  // Calculate total putts by summing actual putts per hole
  const totalPutts = Array.from(holeGroups.values()).reduce((sum, holePutts) => sum + countActualPutts(holePutts), 0);
  const avgPuttsPerHole = holesPlayed > 0 ? (totalPutts / holesPlayed) : 0;

  // Calculate total distance of holed putts (excluding chip-ins)
  const holedPutts = putts.filter(p => p.made && p.puttNumber !== 0);
  const totalHoledDistance = holedPutts.reduce((sum, p) => sum + p.distance, 0);

// Count putts by category
  let chipIns = 0;
  let onePutts = 0;
  let twoPutts = 0;
  let threePlusPutts = 0;

  holeGroups.forEach((holePutts) => {
    const count = countActualPutts(holePutts);
    if (count === 0) chipIns++;
    else if (count === 1) onePutts++;
    else if (count === 2) twoPutts++;
    else if (count >= 3) threePlusPutts++;
  });

  // Create hole-by-hole breakdown
  const holeSummaries: HoleSummary[] = [];
  holeGroups.forEach((holePutts, holeNumber) => {
    holePutts.sort((a, b) => (a.puttNumber || 0) - (b.puttNumber || 0));
    const holedPutt = holePutts.find(p => p.made);
    holeSummaries.push({
      hole: holeNumber,
      puttCount: countActualPutts(holePutts),
      putts: holePutts,
      holedDistance: holedPutt?.distance || 0,
    });
  });

  holeSummaries.sort((a, b) => a.hole - b.hole);

  // Calculate OUT/IN totals for full 18-hole rounds
  const outPutts = holeSummaries.filter(h => h.hole >= 1 && h.hole <= 9).reduce((sum, h) => sum + h.puttCount, 0);
  const inPutts = holeSummaries.filter(h => h.hole >= 10 && h.hole <= 18).reduce((sum, h) => sum + h.puttCount, 0);

  // Calculate comparison metrics against last 5 rounds
  const calculateComparison = (): ComparisonMetrics | null => {
    if (last5Rounds.length === 0) return null;

    // Current round metrics
    const currentTotalPutts = totalPutts;
    const currentTotalPutts18 = holesPlayed > 0 ? (totalPutts / holesPlayed) * 18 : 0;
    const currentAvgPerHole = avgPuttsPerHole;
    const currentTotalMakeDist = totalHoledDistance;

    // Calculate last 5 rounds putt breakdown (normalized to 18 holes)
    const last5BreakdownData = last5Rounds.map(r => {
      // Count putt types for this round
      const holeMap = new Map<number, PuttingAttempt[]>();
      r.putts?.forEach(p => {
        if (p.holeNumber !== undefined) {
          if (!holeMap.has(p.holeNumber)) {
            holeMap.set(p.holeNumber, []);
          }
          holeMap.get(p.holeNumber)!.push(p);
        }
      });

      let roundOnePutts = 0;
      let roundTwoPutts = 0;
      let roundThreePutts = 0;

      holeMap.forEach(holePutts => {
        const count = countActualPutts(holePutts);
        if (count === 1) roundOnePutts++;
        else if (count === 2) roundTwoPutts++;
        else if (count >= 3) roundThreePutts++;
      });

      // Normalize to 18 holes
      const scale = r.holesPlayed > 0 ? 18 / r.holesPlayed : 0;
      return {
        onePutts: roundOnePutts * scale,
        twoPutts: roundTwoPutts * scale,
        threePutts: roundThreePutts * scale,
      };
    });

    // Last 5 rounds averages
    const last5TotalPutts = last5Rounds
      .map(r => r.totalPutts)
      .reduce((sum, val) => sum + val, 0) / last5Rounds.length;

    const last5TotalPutts18 = last5Rounds
      .map(r => r.holesPlayed > 0 ? (r.totalPutts / r.holesPlayed) * 18 : 0)
      .reduce((sum, val) => sum + val, 0) / last5Rounds.length;

    const last5AvgPerHole = last5Rounds
      .map(r => r.holesPlayed > 0 ? r.totalPutts / r.holesPlayed : 0)
      .reduce((sum, val) => sum + val, 0) / last5Rounds.length;

    const last5AvgTotalMakeDist = last5Rounds.length > 0
      ? last5Rounds.reduce((sum, r) => {
          const madePutts = r.putts?.filter(p => p.made && p.puttNumber !== 0) || [];
          return sum + madePutts.reduce((s, p) => s + p.distance, 0);
        }, 0) / last5Rounds.length
      : 0;

    const last5AvgOnePutts = last5BreakdownData.reduce((sum, d) => sum + d.onePutts, 0) / last5Rounds.length;
    const last5AvgTwoPutts = last5BreakdownData.reduce((sum, d) => sum + d.twoPutts, 0) / last5Rounds.length;
    const last5AvgThreePutts = last5BreakdownData.reduce((sum, d) => sum + d.threePutts, 0) / last5Rounds.length;

    // Current round breakdown (normalized to 18 holes)
    const scale = holesPlayed > 0 ? 18 / holesPlayed : 0;
    const currentOnePutts18 = onePutts * scale;
    const currentTwoPutts18 = twoPutts * scale;
    const currentThreePutts18 = threePlusPutts * scale;

    return {
      totalPutts: {
        current: currentTotalPutts,
        avg: last5TotalPutts,
        delta: currentTotalPutts - last5TotalPutts,
      },
      totalPutts18: {
        current: currentTotalPutts18,
        avg: last5TotalPutts18,
        delta: currentTotalPutts18 - last5TotalPutts18,
      },
      avgPerHole: {
        current: currentAvgPerHole,
        avg: last5AvgPerHole,
        delta: currentAvgPerHole - last5AvgPerHole,
      },
      totalMakeDist: {
        current: currentTotalMakeDist,
        avg: last5AvgTotalMakeDist,
        delta: currentTotalMakeDist - last5AvgTotalMakeDist,
      },
      onePutts: {
        current: currentOnePutts18,
        avg: last5AvgOnePutts,
        delta: currentOnePutts18 - last5AvgOnePutts,
      },
      twoPutts: {
        current: currentTwoPutts18,
        avg: last5AvgTwoPutts,
        delta: currentTwoPutts18 - last5AvgTwoPutts,
      },
      threePutts: {
        current: currentThreePutts18,
        avg: last5AvgThreePutts,
        delta: currentThreePutts18 - last5AvgThreePutts,
      },
    };
  };

  const comparison = calculateComparison();

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    return date.toLocaleDateString('en-AU', options);
  };

  const handleSaveCourse = () => {
    if (onEditMetadata && editCourseName.trim()) {
      onEditMetadata(editCourseName, date);
    }
    setIsEditingCourse(false);
  };

  const handleSaveDate = () => {
    if (onEditMetadata) {
      onEditMetadata(courseName, editDate);
    }
    setIsEditingDate(false);
  };

  // Calculate next hole to add
  const playedHoles = Array.from(new Set(putts.map(p => p.holeNumber).filter(h => h !== undefined)));
  const maxHole = playedHoles.length > 0 ? Math.max(...playedHoles) : 0;

  // Determine next hole: if max < 18, add max+1, otherwise find first missing hole starting from 1
  let nextHole = 1;
  if (maxHole < 18) {
    nextHole = maxHole + 1;
  } else {
    // Find first hole not played
    for (let i = 1; i <= 18; i++) {
      if (!playedHoles.includes(i)) {
        nextHole = i;
        break;
      }
    }
  }

  const handleAddHole = () => {
    if (onAddHole) {
      onAddHole(nextHole);
    }
  };

  return (
    <div className="round-summary">
      <div className="round-summary-content">
        {/* Header with edit toggle */}
        <div className="round-summary-header">
          <div className="round-summary-success-icon">
            <Check size={32} strokeWidth={3} />
          </div>
          <h1 className="round-summary-title">Round completed</h1>
          <p className="round-summary-subtitle">
            {isHistorical ? 'Round summary' : 'Your round has been saved successfully'}
          </p>
          {/* Edit mode toggle button */}
          {(onEditMetadata || onEditHole) && (
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className="round-summary-edit-toggle"
              aria-label={isEditMode ? 'Exit edit mode' : 'Enter edit mode'}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: isEditMode ? '#4CAF50' : '#444',
                color: isEditMode ? 'white' : '#ccc',
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              <Edit3 size={18} />
            </button>
          )}
        </div>

        {/* Main stats card */}
        <div className="round-summary-main-card">
          <div className="round-summary-course-info">
            {isEditingCourse ? (
              <input
                type="text"
                value={editCourseName}
                onChange={(e) => setEditCourseName(e.target.value)}
                onBlur={handleSaveCourse}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveCourse();
                }}
                className="round-summary-input"
                autoFocus
                style={{ fontSize: '1.25rem', fontWeight: '600' }}
              />
            ) : (
              <h2
                onClick={() => isEditMode && setIsEditingCourse(true)}
                style={{
                  cursor: isEditMode ? 'pointer' : 'default',
                  margin: 0
                }}
              >
                {courseName}
              </h2>
            )}
            {isEditingDate ? (
              <input
                type="date"
                value={editDate.toISOString().split('T')[0]}
                onChange={(e) => setEditDate(new Date(e.target.value))}
                onBlur={handleSaveDate}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveDate();
                }}
                className="round-summary-input"
                autoFocus
              />
            ) : (
              <p
                onClick={() => isEditMode && setIsEditingDate(true)}
                style={{
                  cursor: isEditMode ? 'pointer' : 'default',
                  margin: 0
                }}
              >
                {formatDate(date)}
              </p>
            )}
          </div>
          <div className="round-summary-total-putts">
            <div className="round-summary-putts-number">{totalPutts}</div>
            <div className="round-summary-putts-label">
              Total putts • {holesPlayed} Hole{holesPlayed !== 1 ? 's' : ''}
            </div>
            {comparison && (
              <div style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginTop: '4px'
              }}>
                {comparison.totalPutts.delta < 0 ? '▼' : comparison.totalPutts.delta > 0 ? '▲' : '—'} {Math.abs(comparison.totalPutts.delta).toFixed(1)}
              </div>
            )}
            {holesPlayed === 18 && (
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
                marginTop: '0.25rem',
                display: 'flex',
                gap: '1rem',
                justifyContent: 'center'
              }}>
                <span>OUT: {outPutts}</span>
                <span>IN: {inPutts}</span>
              </div>
            )}
          </div>
        </div>

        {/* Supporting stats */}
        <div className="round-summary-stats-grid">
          <div className="round-summary-stat-card">
            <div className="round-summary-stat-value">{avgPuttsPerHole.toFixed(2)}</div>
            <div className="round-summary-stat-label">Avg per hole</div>
            {comparison && (
              <div style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginTop: '4px'
              }}>
                {comparison.avgPerHole.delta < 0 ? '▼' : comparison.avgPerHole.delta > 0 ? '▲' : '—'} {Math.abs(comparison.avgPerHole.delta).toFixed(2)}
              </div>
            )}
          </div>
          <div className="round-summary-stat-card">
            <div className="round-summary-stat-value">{totalHoledDistance.toFixed(1)}m</div>
            <div className="round-summary-stat-label">Total dist holed</div>
            {comparison && (
              <div style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginTop: '4px'
              }}>
                {comparison.totalMakeDist.delta > 0 ? '▲' : comparison.totalMakeDist.delta < 0 ? '▼' : '—'} {Math.abs(comparison.totalMakeDist.delta).toFixed(1)}m
              </div>
            )}
          </div>
        </div>

        {/* Putt Breakdown Visual */}
        <div className="round-summary-breakdown-visual">
          <h3 className="round-summary-breakdown-visual-title">Putt Breakdown</h3>
          <div className="round-summary-breakdown-bar">
            {(() => {
              // Build array of visible segments
              const segments: Array<{ type: string; count: number; className: string }> = [];
              if (chipIns > 0) segments.push({ type: 'chip-in', count: chipIns, className: 'chip-in' });
              if (onePutts > 0) segments.push({ type: 'one-putt', count: onePutts, className: 'one-putt' });
              if (twoPutts > 0) segments.push({ type: 'two-putts', count: twoPutts, className: 'two-putts' });
              if (threePlusPutts > 0) segments.push({ type: 'three-plus-putts', count: threePlusPutts, className: 'three-plus-putts' });

              return segments.map((segment, index) => {
                const percentage = (segment.count / holesPlayed) * 100;
                const isFirst = index === 0;
                const isLast = index === segments.length - 1;

                // Determine border radius - need to override CSS with specific values
                let borderRadius = '0'; // Default: no rounded corners
                if (isFirst && isLast) {
                  borderRadius = '8px'; // All corners rounded (only segment)
                } else if (isFirst) {
                  borderRadius = '8px 0 0 8px'; // Left corners rounded
                } else if (isLast) {
                  borderRadius = '0 8px 8px 0'; // Right corners rounded
                }

                return (
                  <div
                    key={segment.type}
                    className={`round-summary-breakdown-segment ${segment.className}`}
                    style={{
                      width: `${percentage}%`,
                      borderRadius: borderRadius
                    }}
                  >
                    <span className="round-summary-breakdown-segment-label">
                      {Math.round(percentage)}%
                    </span>
                  </div>
                );
              });
            })()}
          </div>
          <div className="round-summary-breakdown-legend">
            {chipIns > 0 && (
              <div className="round-summary-breakdown-legend-item">
                <div className="round-summary-breakdown-legend-dot chip-in"></div>
                <span>0 Putts ({chipIns})</span>
              </div>
            )}
            {onePutts > 0 && (
              <div className="round-summary-breakdown-legend-item" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div className="round-summary-breakdown-legend-dot one-putt"></div>
                <span>1 Putt ({onePutts})</span>
                {comparison && (
                  <span style={{
                    fontSize: '0.7rem',
                    color: '#9ca3af',
                    marginLeft: '4px'
                  }}>
                    {comparison.onePutts.delta > 0 ? '▲' : comparison.onePutts.delta < 0 ? '▼' : '—'} {Math.abs(comparison.onePutts.delta).toFixed(1)}
                  </span>
                )}
              </div>
            )}
            {twoPutts > 0 && (
              <div className="round-summary-breakdown-legend-item" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div className="round-summary-breakdown-legend-dot two-putts"></div>
                <span>2 Putts ({twoPutts})</span>
                {comparison && (
                  <span style={{
                    fontSize: '0.7rem',
                    color: '#9ca3af',
                    marginLeft: '4px'
                  }}>
                    {comparison.twoPutts.delta < 0 ? '▼' : comparison.twoPutts.delta > 0 ? '▲' : '—'} {Math.abs(comparison.twoPutts.delta).toFixed(1)}
                  </span>
                )}
              </div>
            )}
            {threePlusPutts > 0 && (
              <div className="round-summary-breakdown-legend-item" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div className="round-summary-breakdown-legend-dot three-plus-putts"></div>
                <span>3+ Putts ({threePlusPutts})</span>
                {comparison && (
                  <span style={{
                    fontSize: '0.7rem',
                    color: '#9ca3af',
                    marginLeft: '4px'
                  }}>
                    {comparison.threePutts.delta < 0 ? '▼' : comparison.threePutts.delta > 0 ? '▲' : '—'} {Math.abs(comparison.threePutts.delta).toFixed(1)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* <div className="round-summary-stats-grid">
          <div className="round-summary-stat-card">
            <div className="round-summary-stat-value">{onePutts}</div>
            <div className="round-summary-stat-label">1-putts</div>
          </div>
          <div className="round-summary-stat-card">
            <div className="round-summary-stat-value">{twoPutts}</div>
            <div className="round-summary-stat-label">2-putts</div>
          </div>
          <div className="round-summary-stat-card">
            <div className="round-summary-stat-value">{threePlusPutts}</div>
            <div className="round-summary-stat-label">3+ putts</div>
          </div>
        </div> */}

        {/* Hole by hole breakdown */}
        <div className="round-summary-breakdown">
          <h3 className="round-summary-breakdown-title">Hole by Hole</h3>
          <div className="round-summary-hole-list">
            {holeSummaries.map((holeSummary) => {
              const puttSequence = buildPuttSequence(holeSummary.putts);
              const keySignal = detectKeySignal(holeSummary.putts);
              const holeAverage = getHoleAverage(holeSummary.hole);

              return (
                <div
                  key={holeSummary.hole}
                  className="round-summary-hole-item"
                  onClick={() => {
                    if (isEditMode && onEditHole) {
                      onEditHole(holeSummary.hole);
                    } else if (!isEditMode && onViewHole) {
                      onViewHole(holeSummary.hole);
                    }
                  }}
                  style={{
                    cursor: (isEditMode && onEditHole) || (!isEditMode && onViewHole) ? 'pointer' : 'default'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ flex: 1 }}>
                      <div className="round-summary-hole-number">
                        Hole {holeSummary.hole}
                      </div>
                      <div className="round-summary-hole-sequence" style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        marginTop: '4px',
                        opacity: 0.7
                      }}>
                        {puttSequence}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {keySignal && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: '#9ca3af',
                        }}>
                          {keySignal.type === 'long-make' && <Award size={16} strokeWidth={2} />}
                          {keySignal.type === 'short-miss' && <CircleX size={16} strokeWidth={2} />}
                          {keySignal.type === 'critical-make' && <Target size={16} strokeWidth={2} />}
                          {keySignal.type === 'nice-bonus' && <Star size={16} strokeWidth={2} />}
                          {keySignal.type === 'poor-speed' && <UnfoldVertical size={16} strokeWidth={2} />}
                          {keySignal.type === 'missed-opportunity' && <RedoDot size={16} strokeWidth={2} />}
                          {keySignal.type === 'great-lag' && <Ruler size={16} strokeWidth={2} />}
                          {keySignal.type === 'great-approach' && <Crosshair size={16} strokeWidth={2} />}
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            {getSignalLabel(keySignal)}
                          </span>
                        </div>
                      )}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '1.5rem',
                          color: 'white',
                          fontWeight: '600',
                          minWidth: '32px',
                          lineHeight: 1
                        }}>
                          {holeSummary.puttCount}
                        </div>
                        {holeAverage !== null && (
                          <div style={{
                            fontSize: '0.7rem',
                            color: '#6b7280',
                            marginTop: '2px'
                          }}>
                            Avg: {holeAverage.toFixed(1)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Add hole button - shown when < 18 holes and in edit mode */}
            {holesPlayed < 18 && onAddHole && isEditMode && (
              <button
                onClick={handleAddHole}
                className="home-round-action-button home-round-view-button"
                style={{
                  width: '100%',
                  marginTop: '8px',
                }}
              >
                + Add hole {nextHole}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fixed footer with Done button */}
      <div className="round-summary-footer">
        <button style={{width: '100%'}} className="home-round-action-button home-round-view-button" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
