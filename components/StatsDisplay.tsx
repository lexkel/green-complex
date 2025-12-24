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
  const roundStats: RoundStats[] = rounds.map((round, index) => ({
    roundNumber: rounds.length - index,
    totalPutts: round.totalPutts,
    avgPutts: round.holesPlayed > 0 ? round.totalPutts / round.holesPlayed : 0,
    timestamp: round.timestamp,
  })).reverse();

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
    { label: '3m +', min: 3, max: Infinity },
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
          <div className="stats-summary-value">{avgPuttsPerHole.toFixed(2)}</div>
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

      {/* Average Putts Trend */}
      {last10Rounds.length > 0 && (
        <div className="stats-section-modern">
          <div className="stats-section-header">
            <h3>Average Putts</h3>
            <span className="stats-section-subtitle">Last 10 Rounds</span>
          </div>
          <div className="trend-chart">
            <svg width="100%" height="200" viewBox="0 0 500 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="avgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(74, 222, 128, 0.3)" />
                  <stop offset="100%" stopColor="rgba(74, 222, 128, 0)" />
                </linearGradient>
              </defs>
              {/* Area under curve */}
              <path
                d={generateAreaPath(last10Rounds.map(r => r.avgPutts))}
                fill="url(#avgGradient)"
              />
              {/* Line */}
              <path
                d={generateLinePath(last10Rounds.map(r => r.avgPutts))}
                fill="none"
                stroke="#4ade80"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Last point */}
              <circle
                cx={(last10Rounds.length - 1) * (500 / (last10Rounds.length - 1))}
                cy={200 - ((last10Rounds[last10Rounds.length - 1].avgPutts - Math.min(...last10Rounds.map(r => r.avgPutts)) + 0.5) / (Math.max(...last10Rounds.map(r => r.avgPutts)) - Math.min(...last10Rounds.map(r => r.avgPutts)) + 1)) * 160}
                r="6"
                fill="white"
                stroke="#4ade80"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Total Putts Trend */}
      {last10Rounds.length > 0 && (
        <div className="stats-section-modern">
          <div className="stats-section-header">
            <h3>Total Putts</h3>
            <span className="stats-section-subtitle">Trend</span>
          </div>
          <div className="trend-chart trend-chart-secondary">
            <div className="trend-chart-value">{last10Rounds[last10Rounds.length - 1]?.totalPutts || 0}</div>
            <div className="trend-chart-label">Latest</div>
            <svg width="100%" height="120" viewBox="0 0 500 120" preserveAspectRatio="none">
              {/* Dotted line */}
              <path
                d={generateLinePath(last10Rounds.map(r => r.totalPutts), 120)}
                fill="none"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
            </svg>
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
          {/* <div className="stats-card-badge">High</div> */}
        </div>
        <div className="stats-card-modern">
          <div className="stats-card-label">AVG MAKE DIST</div>
          <div className="stats-card-value">
            {calculateAvgMakeDistance(putts).toFixed(1)}m
          </div>
          {/* 
          <div className="stats-card-badge">Avg</div> */}
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
function generateAreaPath(values: number[]): string {
  if (values.length === 0) return '';

  const linePath = generateLinePath(values);
  const lastX = (values.length - 1) * (500 / (values.length - 1 || 1));

  return `${linePath} L ${lastX},200 L 0,200 Z`;
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
