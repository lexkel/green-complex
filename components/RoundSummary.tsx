'use client';

import { useState, useEffect } from 'react';
import { PuttingAttempt } from '@/types';
import { Check, Edit3 } from 'lucide-react';

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

export function RoundSummary({ putts, courseName, date, onDone, onEditMetadata, onEditHole, onViewHole, onAddHole, isHistorical = false }: RoundSummaryProps) {
  const [editCourseName, setEditCourseName] = useState(courseName);
  const [editDate, setEditDate] = useState(date);
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); // Master edit mode toggle

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

  // Calculate OUT/IN totals for full 18-hole rounds
  const outPutts = holeSummaries.filter(h => h.hole >= 1 && h.hole <= 9).reduce((sum, h) => sum + h.puttCount, 0);
  const inPutts = holeSummaries.filter(h => h.hole >= 10 && h.hole <= 18).reduce((sum, h) => sum + h.puttCount, 0);

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
                <div className="round-summary-hole-number">
                  Hole {holeSummary.hole}
                </div>
                <div className="round-summary-hole-putts">
                  {holeSummary.puttCount} {holeSummary.puttCount === 1 ? 'putt' : 'putts'}
                </div>
                <div className="round-summary-hole-distance">
                  Holed from {holeSummary.holedDistance.toFixed(1)}m
                </div>
              </div>
            ))}
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
