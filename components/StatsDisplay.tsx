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

    return {
      roundNumber: rounds.length - index,
      totalPutts: round.totalPutts,
      avgPutts: round.holesPlayed > 0 ? round.totalPutts / round.holesPlayed : 0,
      timestamp: round.timestamp,
      totalMadeDistance,
    };
  }).reverse();

  // Calculate last 20 rounds for putt breakdown
  const last20Rounds = rounds.slice(0, 20);
  const onePutts = last20Rounds.reduce((sum, round) => {
    const holes = new Map<number, PuttingAttempt[]>();
    round.putts.forEach(p => {
      if (p.holeNumber !== undefined) {
        if (!holes.has(p.holeNumber)) holes.set(p.holeNumber, []);
        holes.get(p.holeNumber)!.push(p);
      }
    });
    return sum + Array.from(holes.values()).filter(h => h.length === 1).length;
  }, 0);

  const twoPutts = last20Rounds.reduce((sum, round) => {
    const holes = new Map<number, PuttingAttempt[]>();
    round.putts.forEach(p => {
      if (p.holeNumber !== undefined) {
        if (!holes.has(p.holeNumber)) holes.set(p.holeNumber, []);
        holes.get(p.holeNumber)!.push(p);
      }
    });
    return sum + Array.from(holes.values()).filter(h => h.length === 2).length;
  }, 0);

  const threePlusPutts = last20Rounds.reduce((sum, round) => {
    const holes = new Map<number, PuttingAttempt[]>();
    round.putts.forEach(p => {
      if (p.holeNumber !== undefined) {
        if (!holes.has(p.holeNumber)) holes.set(p.holeNumber, []);
        holes.get(p.holeNumber)!.push(p);
      }
    });
    return sum + Array.from(holes.values()).filter(h => h.length >= 3).length;
  }, 0);

  const totalHoles = onePutts + twoPutts + threePlusPutts;

  // Calculate avg putts per hole across all rounds
  const totalHolesPlayed = rounds.reduce((sum, r) => sum + r.holesPlayed, 0);
  const avgPuttsPerHole = totalHolesPlayed > 0 ? putts.length / totalHolesPlayed : 0;

  // Calculate change indicators
  const recentRounds = rounds.slice(0, 5);
  const olderRounds = rounds.slice(5, 10);
  const recentAvg = recentRounds.length > 0
    ? recentRounds.reduce((sum, r) => sum + (r.holesPlayed > 0 ? r.totalPutts / r.holesPlayed : 0), 0) / recentRounds.length
    : 0;
  const olderAvg = olderRounds.length > 0
    ? olderRounds.reduce((sum, r) => sum + (r.holesPlayed > 0 ? r.totalPutts / r.holesPlayed : 0), 0) / olderRounds.length
    : 0;
  const avgChange = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

  // Last 10 rounds for trend chart
  const last10Rounds = roundStats.slice(-10);

  // Calculate make probability by distance
  const distanceRanges = [
    { label: '0m — 1m', min: 0, max: 1 },
    { label: '1m — 2m', min: 1, max: 2 },
    { label: '2m — 3m', min: 2, max: 3 },
    { label: '3m — 5m', min: 3, max: 5 },
    { label: '5m +', min: 5, max: Infinity },
  ];

  const makeProbability = distanceRanges.map(range => {
    const puttsInRange = putts.filter(p => p.distance >= range.min && p.distance < range.max);
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
    // Get first putts in this distance range
    const holesMap = new Map<number, PuttingAttempt[]>();
    putts.forEach(p => {
      if (p.holeNumber !== undefined) {
        if (!holesMap.has(p.holeNumber)) holesMap.set(p.holeNumber, []);
        holesMap.get(p.holeNumber)!.push(p);
      }
    });

    const firstPuttsInRange = Array.from(holesMap.values())
      .map(holePutts => holePutts.sort((a, b) => (a.puttNumber || 0) - (b.puttNumber || 0))[0])
      .filter(p => p.distance >= range.min && p.distance < range.max);

    // Count holes where first putt was in range and took 3+ putts
    const threePutts = firstPuttsInRange.filter(firstPutt => {
      const holeNumber = firstPutt.holeNumber;
      if (holeNumber === undefined) return false;
      const holePutts = holesMap.get(holeNumber) || [];
      return holePutts.length >= 3;
    }).length;

    const total = firstPuttsInRange.length;
    return {
      label: range.label,
      percentage: total > 0 ? (threePutts / total) * 100 : 0,
      threePutts,
      total,
    };
  });

  // Calculate miss direction breakdown
  const missedPutts = putts.filter(p => !p.made && p.missDirection);
  const missDirections = {
    short: missedPutts.filter(p => p.missDirection === 'short').length,
    long: missedPutts.filter(p => p.missDirection === 'long').length,
    left: missedPutts.filter(p => p.missDirection === 'left').length,
    right: missedPutts.filter(p => p.missDirection === 'right').length,
  };
  const totalMisses = missedPutts.length;
  const missPercentages = {
    short: totalMisses > 0 ? (missDirections.short / totalMisses) * 100 : 0,
    long: totalMisses > 0 ? (missDirections.long / totalMisses) * 100 : 0,
    left: totalMisses > 0 ? (missDirections.left / totalMisses) * 100 : 0,
    right: totalMisses > 0 ? (missDirections.right / totalMisses) * 100 : 0,
  };

  return (
    <div className="stats-display-modern">
      {/* Top Summary Cards */}
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

      {/* Putt Breakdown */}
      <div className="stats-section-modern">
        <div className="stats-section-header">
          <h3>Putt Breakdown</h3>
          <span className="stats-section-subtitle">Last 20 Rounds</span>
        </div>
        <div className="putt-breakdown-bar">
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
        <div className="putt-breakdown-legend">
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
        <h3>Make Probability</h3>
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
          <h3>Miss Direction</h3>
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

      {/* Distance stat cards at bottom */}
      <div className="stats-grid-modern">
        <div className="stats-card-modern">
          <div className="stats-card-label">AVG 1ST PUTT DIST</div>
          <div className="stats-card-value">
            {calculateAvgFirstPuttDistance(putts).toFixed(1)}m
          </div>
        </div>
        <div className="stats-card-modern">
          <div className="stats-card-label">AVG MAKE DIST</div>
          <div className="stats-card-value">
            {calculateAvgMakeDistance(putts).toFixed(1)}m
          </div>
        </div>
      </div>
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
