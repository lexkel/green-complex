'use client';

import { useState, useEffect } from 'react';
import { PuttingAttempt } from '@/types';
import { Check, Pencil } from 'lucide-react';

interface RoundSummaryProps {
  putts: PuttingAttempt[];
  courseName: string;
  date: Date;
  onDone: () => void;
  onEditMetadata?: (courseName: string, date: Date) => void;
  onEditHole?: (holeNumber: number) => void;
  isHistorical?: boolean; // Whether viewing a saved round from history
}

interface HoleSummary {
  hole: number;
  puttCount: number;
  putts: PuttingAttempt[];
  holedDistance: number;
}

export function RoundSummary({ putts, courseName, date, onDone, onEditMetadata, onEditHole, isHistorical = false }: RoundSummaryProps) {
  const [editCourseName, setEditCourseName] = useState(courseName);
  const [editDate, setEditDate] = useState(date);
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);

  // Sync props with local state when they change
  useEffect(() => {
    setEditCourseName(courseName);
  }, [courseName]);

  useEffect(() => {
    setEditDate(date);
  }, [date]);

  // Calculate statistics
  const holesPlayed = new Set(putts.map(p => p.holeNumber).filter(h => h !== undefined)).size;
  const totalPutts = putts.length;
  const avgPuttsPerHole = holesPlayed > 0 ? (totalPutts / holesPlayed) : 0;

  // Calculate total distance of holed putts
  const holedPutts = putts.filter(p => p.made);
  const totalHoledDistance = holedPutts.reduce((sum, p) => sum + p.distance, 0);

  // Calculate average distance of holed putts (the last putt on every hole)
  const avgHoledDistance = holedPutts.length > 0 ? (totalHoledDistance / holedPutts.length) : 0;

  // Count putts by type (1-putt, 2-putt, 3+)
  const holeGroups = new Map<number, PuttingAttempt[]>();
  putts.forEach(p => {
    if (p.holeNumber !== undefined) {
      if (!holeGroups.has(p.holeNumber)) {
        holeGroups.set(p.holeNumber, []);
      }
      holeGroups.get(p.holeNumber)!.push(p);
    }
  });

  let onePutts = 0;
  let twoPutts = 0;
  let threePlusPutts = 0;

  holeGroups.forEach((holePutts) => {
    const count = holePutts.length;
    if (count === 1) onePutts++;
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
      puttCount: holePutts.length,
      putts: holePutts,
      holedDistance: holedPutt?.distance || 0,
    });
  });

  holeSummaries.sort((a, b) => a.hole - b.hole);

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

  return (
    <div className="round-summary">
      <div className="round-summary-content">
        {/* Header */}
        <div className="round-summary-header">
          <div className="round-summary-success-icon">
            <Check size={32} strokeWidth={3} />
          </div>
          <h1 className="round-summary-title">Round completed</h1>
          <p className="round-summary-subtitle">
            {isHistorical ? 'Round summary' : 'Your round has been saved successfully'}
          </p>
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
              <h2 onClick={() => setIsEditingCourse(true)} style={{ cursor: 'pointer' }}>
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
              <p onClick={() => setIsEditingDate(true)} style={{ cursor: 'pointer' }}>
                {formatDate(date)} • {holesPlayed} Hole{holesPlayed !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="round-summary-total-putts">
            <div className="round-summary-putts-number">{totalPutts}</div>
            <div className="round-summary-putts-label">Total putts</div>
          </div>
        </div>

        {/* Supporting stats */}
        <div className="round-summary-stats-grid">
          <div className="round-summary-stat-card">
            <div className="round-summary-stat-value">{avgPuttsPerHole.toFixed(2)}</div>
            <div className="round-summary-stat-label">Avg per hole</div>
          </div>
          <div className="round-summary-stat-card">
            <div className="round-summary-stat-value">{avgHoledDistance.toFixed(1)}m</div>
            <div className="round-summary-stat-label">Avg dist holed</div>
          </div>
        </div>

        {/* Putt Breakdown Visual */}
        <div className="round-summary-breakdown-visual">
          <h3 className="round-summary-breakdown-visual-title">Putt Breakdown</h3>
          <div className="round-summary-breakdown-bar">
            {onePutts > 0 && (
              <div
                className="round-summary-breakdown-segment one-putt"
                style={{ width: `${(onePutts / holesPlayed) * 100}%` }}
              >
                <span className="round-summary-breakdown-segment-label">
                  {Math.round((onePutts / holesPlayed) * 100)}%
                </span>
              </div>
            )}
            {twoPutts > 0 && (
              <div
                className="round-summary-breakdown-segment two-putts"
                style={{ width: `${(twoPutts / holesPlayed) * 100}%` }}
              >
                <span className="round-summary-breakdown-segment-label">
                  {Math.round((twoPutts / holesPlayed) * 100)}%
                </span>
              </div>
            )}
            {threePlusPutts > 0 && (
              <div
                className="round-summary-breakdown-segment three-plus-putts"
                style={{ width: `${(threePlusPutts / holesPlayed) * 100}%` }}
              >
                <span className="round-summary-breakdown-segment-label">
                  {Math.round((threePlusPutts / holesPlayed) * 100)}%
                </span>
              </div>
            )}
          </div>
          <div className="round-summary-breakdown-legend">
            <div className="round-summary-breakdown-legend-item">
              <div className="round-summary-breakdown-legend-dot one-putt"></div>
              <span>1 Putt</span>
            </div>
            <div className="round-summary-breakdown-legend-item">
              <div className="round-summary-breakdown-legend-dot two-putts"></div>
              <span>2 Putts</span>
            </div>
            <div className="round-summary-breakdown-legend-item">
              <div className="round-summary-breakdown-legend-dot three-plus-putts"></div>
              <span>3+ Putts</span>
            </div>
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
            {holeSummaries.map((holeSummary) => (
              <div key={holeSummary.hole} className="round-summary-hole-item">
                <div className="round-summary-hole-number">
                  Hole {holeSummary.hole}
                </div>
                <div className="round-summary-hole-putts">
                  {holeSummary.puttCount} {holeSummary.puttCount === 1 ? 'putt' : 'putts'}
                </div>
                <div className="round-summary-hole-distance">
                  Holed from {holeSummary.holedDistance.toFixed(1)}m
                </div>
                {onEditHole && (
                  <button
                    className="round-summary-hole-edit"
                    onClick={() => onEditHole(holeSummary.hole)}
                    aria-label={`Edit hole ${holeSummary.hole}`}
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed footer with Done button */}
      <div className="round-summary-footer">
        <button className="round-summary-done-button" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
