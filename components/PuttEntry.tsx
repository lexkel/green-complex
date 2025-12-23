'use client';

import { useState, useRef, useEffect } from 'react';
import { Flag, Trash2 } from 'lucide-react';
import { PuttingAttempt } from '@/types';
import { NEANGAR_PARK, COURSES, getHoleData, GreenShape, HoleData, CourseData } from '@/data/courses';
import { RoundHistory } from '@/lib/roundHistory';
import { ActiveRoundStorage, ActiveRoundData, HoleState as ActiveHoleState } from '@/lib/activeRound';
import { GreenShapeImporter } from '@/lib/greenShapeImporter';

interface PuttEntryProps {
  onAddPutt: (putt: PuttingAttempt) => void;
  isOnline: boolean;
  onRoundStateChange?: (pendingCount: number, holesComplete: number, saveRound: () => void, getRoundData: () => {putts: PuttingAttempt[], courseName: string, startTimestamp: string}) => void;
  onRoundComplete?: (roundData: {putts: PuttingAttempt[], courseName: string, startTimestamp: string}) => void;
  resetRound?: boolean; // Trigger to reset the entire round
  onNavigateHome?: () => void; // Callback to navigate back to home
  onDiscardRound?: () => void; // Callback when round is discarded
  courseId?: string; // Course ID to use for this round
}

interface Position {
  x: number;
  y: number;
}

interface HoleState {
  hole: number;
  puttHistory: Array<{puttNum: number, distance: number, startProximity: any, endProximity: any, endDistance: number, made?: boolean}>;
  pinPosition: Position;
  ballPosition: Position | null;
  distance: number;
  distanceInputValue: string;
  puttNumber: number;
  holeComplete: boolean;
  greenScale: number;
  greenShape: { rx: number; ry: number };
  canvasZoom: number;
  viewBoxOffset: Position;
  pendingPutts: PuttingAttempt[]; // Putts waiting to be saved to Google Sheets
}

const TAP_IN_DISTANCE = 0.4; // metres

export function PuttEntry({ onAddPutt, isOnline, onRoundStateChange, onRoundComplete, resetRound, onNavigateHome, onDiscardRound, courseId: propCourseId }: PuttEntryProps) {
  const [hasRestoredFromStorage, setHasRestoredFromStorage] = useState(false);
  const [pinPosition, setPinPosition] = useState<Position>({ x: 50, y: 50 });
  const [ballPosition, setBallPosition] = useState<Position | null>(null);
  const [distance, setDistance] = useState<number>(5.5);
  const [greenScale, setGreenScale] = useState<number>(1);
  const [greenShape, setGreenShape] = useState<{ rx: number; ry: number }>({ rx: 55, ry: 63 }); // Legacy - kept for backward compatibility
  const [greenShapeData, setGreenShapeData] = useState<GreenShape | null>(null);
  const [isAdjustingPin, setIsAdjustingPin] = useState(true);
  const [isAdjustingGreen, setIsAdjustingGreen] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState<number>(2.2);
  const [puttNumber, setPuttNumber] = useState(1);
  const [hole, setHole] = useState(1);
  const [courseId, setCourseId] = useState(propCourseId || 'neangar-park');
  const [puttHistory, setPuttHistory] = useState<Array<{puttNum: number, distance: number, startProximity: any, endProximity: any, endDistance: number, made?: boolean}>>([]);

  // Store hole states for navigation
  const [holeStates, setHoleStates] = useState<Map<number, HoleState>>(new Map());

  // Pending putts for current hole (not yet saved to Google Sheets)
  const [pendingPutts, setPendingPutts] = useState<PuttingAttempt[]>([]);

  // Hole selector modal
  const [showHoleSelector, setShowHoleSelector] = useState(false);

  // Update courseId when prop changes
  useEffect(() => {
    if (propCourseId) {
      setCourseId(propCourseId);
    }
  }, [propCourseId]);

  // Notify parent when pending putts change
  useEffect(() => {
    if (onRoundStateChange) {
      // Calculate how many holes are complete (have at least one putt recorded)
      const holesWithPutts = new Set(pendingPutts.map(p => p.holeNumber).filter(h => h !== undefined));

      // Function to get current round data before saving
      const getRoundData = () => {
        const activeRound = ActiveRoundStorage.loadActiveRound();
        return {
          putts: activeRound?.pendingPutts || pendingPutts,
          courseName: activeRound?.courseName || NEANGAR_PARK.name,
          startTimestamp: activeRound?.startTimestamp || new Date().toISOString()
        };
      };

      onRoundStateChange(pendingPutts.length, holesWithPutts.size, handleSaveRound, getRoundData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPutts.length]);

  // Auto-save active round to localStorage whenever state changes
  useEffect(() => {
    // Don't auto-save until we've attempted restoration to avoid clearing saved data
    if (!hasRestoredFromStorage) return;

    if (pendingPutts.length > 0) {
      // Convert Map to Record for JSON serialization
      const holeStatesRecord: Record<number, HoleState> = {};
      holeStates.forEach((state, holeNum) => {
        holeStatesRecord[holeNum] = state;
      });

      // Determine last completed hole
      const completedHoles = Array.from(holeStates.values())
        .filter(state => state.holeComplete)
        .map(state => state.hole)
        .sort((a, b) => b - a);
      const lastCompletedHole = completedHoles[0] || 0;

      // Get course name from courseId
      const course = [...COURSES, ...(typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('customCourses') || '[]') : [])].find(c => c.id === courseId);
      const courseName = course?.name || NEANGAR_PARK.name;

      const activeRoundData: ActiveRoundData = {
        id: Date.now().toString(),
        courseId: courseId,
        courseName: courseName,
        startTimestamp: pendingPutts[0]?.timestamp || new Date().toISOString(),
        currentHole: hole,
        lastCompletedHole: lastCompletedHole,
        pendingPutts: pendingPutts,
        holeStates: holeStatesRecord,
      };

      ActiveRoundStorage.saveActiveRound(activeRoundData);
    } else {
      // No pending putts = no active round
      ActiveRoundStorage.clearActiveRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPutts, holeStates, hole, courseId, hasRestoredFromStorage]);

  // Reset round when requested from parent
  useEffect(() => {
    if (resetRound) {
      setPendingPutts([]);
      setHoleStates(new Map());
      setHole(1);
      resetHoleState();
      setHasRestoredFromStorage(false); // Reset flag so restoration can happen again
    }
  }, [resetRound]);

  // Restore active round from localStorage on mount
  useEffect(() => {
    console.log('[RESTORE] Effect running, resetRound:', resetRound);

    // Don't restore if we're in the process of resetting
    if (resetRound) {
      console.log('[RESTORE] Skipping restoration - resetRound is true');
      setHasRestoredFromStorage(true);
      return;
    }

    const savedRound = ActiveRoundStorage.loadActiveRound();
    console.log('[RESTORE] Loaded from storage:', savedRound);

    if (savedRound) {
      console.log('[RESTORE] Restoring round with', savedRound.pendingPutts.length, 'putts');
      console.log('[RESTORE] Current hole:', savedRound.currentHole);
      console.log('[RESTORE] Hole states:', savedRound.holeStates);
      console.log('[RESTORE] Course ID:', savedRound.courseId);

      // Restore all state from saved round
      setPendingPutts(savedRound.pendingPutts);
      setHole(savedRound.currentHole); // Use currentHole for consistency
      setCourseId(savedRound.courseId); // Restore the course ID

      // Convert Record back to Map
      const restoredMap = new Map<number, HoleState>();
      Object.entries(savedRound.holeStates).forEach(([holeNum, state]) => {
        restoredMap.set(parseInt(holeNum), state as HoleState);
      });
      setHoleStates(restoredMap);

      // Restore current hole state directly from the restored map
      const currentHoleState = restoredMap.get(savedRound.currentHole);
      console.log('[RESTORE] Current hole state:', currentHoleState);

      if (currentHoleState) {
        console.log('[RESTORE] Restoring hole state with', currentHoleState.puttHistory.length, 'putts in history');
        // Restore all state directly (can't use restoreHoleState function because state hasn't updated yet)
        setPuttHistory(currentHoleState.puttHistory);
        setPinPosition(currentHoleState.pinPosition);
        setBallPosition(currentHoleState.ballPosition);
        setDistance(currentHoleState.distance);
        setDistanceInputValue(currentHoleState.distanceInputValue);
        setPuttNumber(currentHoleState.puttNumber);
        setHoleComplete(currentHoleState.holeComplete);
        setGreenScale(currentHoleState.greenScale);
        setGreenShape(currentHoleState.greenShape);
        setCanvasZoom(currentHoleState.canvasZoom);
        setViewBoxOffset(currentHoleState.viewBoxOffset);
      } else {
        console.log('[RESTORE] No hole state found for hole', savedRound.currentHole);
      }
    } else {
      console.log('[RESTORE] No saved round found in storage');
    }

    // Mark restoration as complete (whether we found saved data or not)
    setHasRestoredFromStorage(true);
    console.log('[RESTORE] Restoration complete');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on component mount

  // Get current hole data from course (including custom courses from localStorage)
  const getCurrentHoleData = (): HoleData | undefined => {
    // First try built-in courses
    let currentHole = getHoleData(courseId, hole);

    // If not found, try custom courses from localStorage
    if (!currentHole && typeof window !== 'undefined') {
      const customCourses: CourseData[] = JSON.parse(localStorage.getItem('customCourses') || '[]');
      const course = customCourses.find(c => c.id === courseId);
      currentHole = course?.holes.find(h => h.number === hole);
    }

    return currentHole;
  };

  const currentHole = getCurrentHoleData();
  const par = currentHole?.par || 4;
  const holeDistance = currentHole?.distance || 0;

  // Load green shape from course data when hole changes
  useEffect(() => {
    if (currentHole?.greenShape) {
      setGreenShapeData(currentHole.greenShape);
    } else {
      // Fallback to default ellipse for backward compatibility
      setGreenShapeData(GreenShapeImporter.createDefaultEllipse());
    }
  }, [hole, courseId, currentHole]);

  const [holeComplete, setHoleComplete] = useState(false);
  const [distanceInputValue, setDistanceInputValue] = useState<string>('_._');
  const [puttStartProximity, setPuttStartProximity] = useState<any>(null);
  const [puttStartDistance, setPuttStartDistance] = useState<number>(0);
  const [waitingForEndPosition, setWaitingForEndPosition] = useState(false);
  const greenRef = useRef<SVGSVGElement>(null);
  const prevZoomRef = useRef<number>(canvasZoom);
  const [isPinching, setIsPinching] = useState(false);
  const initialPinchDistance = useRef<number>(0);
  const initialZoom = useRef<number>(canvasZoom);
  const incrementInterval = useRef<NodeJS.Timeout | null>(null);
  const decrementInterval = useRef<NodeJS.Timeout | null>(null);
  const [viewBoxOffset, setViewBoxOffset] = useState<Position>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartPos = useRef<Position>({ x: 0, y: 0 });
  const panStartOffset = useRef<Position>({ x: 0, y: 0 });

  // Maintain ball distance when zoom changes
  useEffect(() => {
    if (prevZoomRef.current !== canvasZoom && ballPosition) {
      // Calculate current distance in meters using old zoom
      const dx = ballPosition.x - pinPosition.x;
      const dy = ballPosition.y - pinPosition.y;
      const pixelDistance = Math.sqrt(dx * dx + dy * dy);

      if (pixelDistance === 0) {
        prevZoomRef.current = canvasZoom;
        return;
      }

      const currentDistance = (pixelDistance / 6.214) * prevZoomRef.current;

      // Recalculate ball position for new zoom to maintain distance
      const metersPerPixel = canvasZoom / 6.214;
      const targetPixelDistance = currentDistance / metersPerPixel;
      const ratio = targetPixelDistance / pixelDistance;

      setBallPosition({
        x: pinPosition.x + (dx * ratio),
        y: pinPosition.y + (dy * ratio)
      });

      prevZoomRef.current = canvasZoom;
    }
  }, [canvasZoom, ballPosition, pinPosition.x, pinPosition.y]);

  // Auto-save current hole state whenever it changes
  useEffect(() => {
    // Don't save until restoration is complete
    if (!hasRestoredFromStorage) return;

    // Save current hole state to the holeStates map
    const currentState: HoleState = {
      hole,
      puttHistory,
      pinPosition,
      ballPosition,
      distance,
      distanceInputValue,
      puttNumber,
      holeComplete,
      greenScale,
      greenShape,
      canvasZoom,
      viewBoxOffset,
      pendingPutts: [], // Don't store pendingPutts here, they're managed at component level
    };

    setHoleStates(prevHoleStates => {
      const newHoleStates = new Map(prevHoleStates);
      newHoleStates.set(hole, currentState);
      return newHoleStates;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hole, puttHistory, pinPosition, ballPosition, distance, distanceInputValue, puttNumber, holeComplete, greenScale, greenShape, canvasZoom, viewBoxOffset, hasRestoredFromStorage]);

  const calculateDistance = (pos1: Position, pos2: Position): number => {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);
    // Convert pixel distance to metres based on canvas zoom
    // Calibrated so that max distance on Hole 1 Neangar Park = 34.6m
    // At higher zoom (zoomed out), each grid square represents more distance
    return (pixelDistance / 6.214) * canvasZoom;
  };

  const calculateProximity = (pinPos: Position, ballPos: Position) => {
    // Calculate horizontal (x) and vertical (y) distances
    // Positive horizontal = right of pin, negative = left
    // Positive vertical = beyond pin (long), negative = short
    const dx = ballPos.x - pinPos.x;
    const dy = pinPos.y - ballPos.y; // Inverted because SVG y increases downward

    const metersPerUnit = canvasZoom / 5;

    return {
      horizontal: dx * metersPerUnit,
      vertical: dy * metersPerUnit,
    };
  };

  const proximityToPosition = (proximity: any): Position => {
    // Convert proximity data back to canvas position
    const metersPerUnit = canvasZoom / 5;
    const dx = proximity.horizontal / metersPerUnit;
    const dy = -proximity.vertical / metersPerUnit; // Inverted because SVG y increases downward

    return {
      x: pinPosition.x + dx,
      y: pinPosition.y + dy,
    };
  };

  const handleTouchStart = (e: TouchEvent) => {
    const svg = greenRef.current;
    if (!svg) return;

    if (e.touches.length === 2) {
      // Start pinch gesture
      setIsPinching(true);
      setIsPanning(false);
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      initialPinchDistance.current = distance;
      initialZoom.current = canvasZoom;
      e.preventDefault();
    } else if (e.touches.length === 1) {
      // Single touch - start potential pan
      const touch = e.touches[0];
      panStartPos.current = {
        x: touch.clientX,
        y: touch.clientY
      };
      panStartOffset.current = { ...viewBoxOffset };
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    const svg = greenRef.current;
    if (!svg) return;

    if (e.touches.length === 2 && isPinching) {
      // Pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      const scale = distance / initialPinchDistance.current;
      const newZoom = Math.max(0.5, Math.min(4, initialZoom.current / scale));
      setCanvasZoom(newZoom);
      e.preventDefault();
    } else if (e.touches.length === 1 && !isPinching) {
      // Single finger pan - check if moved enough to be a pan
      const touch = e.touches[0];
      const deltaX = touch.clientX - panStartPos.current.x;
      const deltaY = touch.clientY - panStartPos.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // If moved more than 10 pixels, it's a pan
      if (distance > 10 || isPanning) {
        if (!isPanning) {
          setIsPanning(true);
        }

        const rect = svg.getBoundingClientRect();
        // Convert pixel movement to viewBox units
        const viewBoxDeltaX = -(deltaX / rect.width) * 100;
        const viewBoxDeltaY = -(deltaY / rect.height) * 100;

        setViewBoxOffset({
          x: panStartOffset.current.x + viewBoxDeltaX,
          y: panStartOffset.current.y + viewBoxDeltaY
        });

        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (isPinching) {
      setIsPinching(false);
      e.preventDefault();
    }
    if (isPanning) {
      setIsPanning(false);
    }
  };

  // Add touch event listeners for pinch-to-zoom
  useEffect(() => {
    const svg = greenRef.current;
    if (!svg) return;

    svg.addEventListener('touchstart', handleTouchStart, { passive: false });
    svg.addEventListener('touchmove', handleTouchMove, { passive: false });
    svg.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      svg.removeEventListener('touchstart', handleTouchStart);
      svg.removeEventListener('touchmove', handleTouchMove);
      svg.removeEventListener('touchend', handleTouchEnd);
    };
  });

  const handleGreenClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!greenRef.current || isPinching || isPanning) return;

    // Disable green interaction when hole is complete
    if (holeComplete) return;

    const svg = greenRef.current;
    const rect = svg.getBoundingClientRect();
    // Account for viewBox offset
    const x = ((e.clientX - rect.left) / rect.width) * 100 + viewBoxOffset.x;
    const y = ((e.clientY - rect.top) / rect.height) * 100 + viewBoxOffset.y;

    if (isAdjustingPin) {
      setPinPosition({ x, y });
      setIsAdjustingPin(false);
      // Recalculate distance if ball is positioned
      if (ballPosition) {
        const newDist = calculateDistance({ x, y }, ballPosition);
        const roundedDist = parseFloat(newDist.toFixed(1));
        setDistance(roundedDist);
        setDistanceInputValue(roundedDist.toFixed(1));
      }
    } else {
      setBallPosition({ x, y });
      // Calculate distance to pin
      const newDist = calculateDistance(pinPosition, { x, y });
      const roundedDist = parseFloat(newDist.toFixed(1));
      setDistance(roundedDist);
      setDistanceInputValue(roundedDist.toFixed(1));

      // If waiting for end position after a missed putt, record it now
      if (waitingForEndPosition) {
        recordMissedPutt({ x, y }, roundedDist);
      }
      // If no putts in history yet and hole not complete, create a partial entry
      else if (puttHistory.length === 0 && !holeComplete) {
        const startProximity = calculateProximity(pinPosition, { x, y });
        setPuttHistory([{
          puttNum: puttNumber,
          distance: roundedDist,
          startProximity,
          endProximity: null,
          endDistance: 0,
          made: false
        }]);
      }
      // If we have putts in history but NOT waiting for end position, just update the partial entry's start position
      else if (puttHistory.length > 0 && !holeComplete && !waitingForEndPosition) {
        const lastPutt = puttHistory[puttHistory.length - 1];

        // If last putt is still partial (no endProximity), update its start position
        if (lastPutt.endProximity === null) {
          const newStartProximity = calculateProximity(pinPosition, { x, y });
          const updatedHistory = [...puttHistory];
          const lastPuttIndex = updatedHistory.length - 1;

          updatedHistory[lastPuttIndex] = {
            ...updatedHistory[lastPuttIndex],
            distance: roundedDist,
            startProximity: newStartProximity,
          };

          setPuttHistory(updatedHistory);
        }
        // If last putt is complete, create a new partial entry for next putt
        else {
          const startProximity = calculateProximity(pinPosition, { x, y });
          setPuttHistory([...puttHistory, {
            puttNum: puttNumber,
            distance: roundedDist,
            startProximity,
            endProximity: null,
            endDistance: 0,
            made: false
          }]);
        }
      }
    }
  };

  const recordMissedPutt = (endPosition: Position, endDistance: number) => {
    const endProximity = calculateProximity(pinPosition, endPosition);

    const putt: PuttingAttempt = {
      timestamp: new Date().toISOString(),
      distance: puttStartDistance,
      distanceUnit: 'metres',
      made: false,
      proximity: endProximity,
      startProximity: puttStartProximity,
      pinPosition: { x: pinPosition.x, y: pinPosition.y },
      puttNumber,
      holeNumber: hole,
      course: NEANGAR_PARK.name,
    };

    // Add to pending putts instead of saving immediately
    setPendingPutts([...pendingPutts, putt]);

    // Update the last (partial) putt history entry with end position
    const updatedHistory = [...puttHistory];
    const lastPuttIndex = updatedHistory.length - 1;

    updatedHistory[lastPuttIndex] = {
      ...updatedHistory[lastPuttIndex],
      endProximity,
      endDistance,
    };

    setPuttHistory(updatedHistory);

    // Move to next putt - ball stays at end position, create new partial entry
    setPuttNumber(puttNumber + 1);
    setWaitingForEndPosition(false);

    // Create a new partial entry for the next putt starting from current end position
    const newStartProximity = endProximity;
    setPuttHistory([...updatedHistory, {
      puttNum: puttNumber + 1,
      distance: endDistance,
      startProximity: newStartProximity,
      endProximity: null,
      endDistance: 0,
      made: false
    }]);

    // Ball position stays at endPosition (already set from handleGreenClick)
    // Update distance display for next putt
    setDistance(endDistance);
    setDistanceInputValue(endDistance.toFixed(1));
  };

  const moveBallToDistance = (targetDistance: number) => {
    if (!ballPosition) return; // No ball positioned yet

    // Calculate direction vector from pin to ball
    const dx = ballPosition.x - pinPosition.x;
    const dy = ballPosition.y - pinPosition.y;
    const currentPixelDistance = Math.sqrt(dx * dx + dy * dy);

    if (currentPixelDistance === 0) return; // Prevent division by zero

    // Convert target distance to pixels based on canvas zoom
    const metersPerPixel = canvasZoom / 5;
    const targetPixelDistance = targetDistance / metersPerPixel;

    // Move ball along the same line to the new distance
    const ratio = targetPixelDistance / currentPixelDistance;
    const newBallX = pinPosition.x + (dx * ratio);
    const newBallY = pinPosition.y + (dy * ratio);
    const newPosition = { x: newBallX, y: newBallY };

    setBallPosition(newPosition);
    setDistance(targetDistance);
    setDistanceInputValue(targetDistance.toFixed(1));

    // If waiting for end position after clicking "Missed it", disable distance adjustment
    // The user should tap to place the end position, not use +/- buttons
    if (waitingForEndPosition) {
      return;
    }

    // Update putt history with new ball position
    if (puttHistory.length > 0 && !holeComplete) {
      const updatedHistory = [...puttHistory];
      const lastPuttIndex = updatedHistory.length - 1;
      const lastPutt = updatedHistory[lastPuttIndex];

      // If last putt is a partial entry (no outcome yet), update its start position
      if (lastPutt.endProximity === null) {
        const newStartProximity = calculateProximity(pinPosition, newPosition);
        updatedHistory[lastPuttIndex] = {
          ...updatedHistory[lastPuttIndex],
          distance: targetDistance,
          startProximity: newStartProximity,
        };

        // Also update the PREVIOUS putt's end position (if it exists)
        if (lastPuttIndex > 0) {
          const newEndProximity = newStartProximity; // Current start = previous end
          updatedHistory[lastPuttIndex - 1] = {
            ...updatedHistory[lastPuttIndex - 1],
            endProximity: newEndProximity,
            endDistance: targetDistance,
          };
        }

        setPuttHistory(updatedHistory);
      }
    }
  };

  const handlePuttOutcome = (made: boolean) => {
    if (!ballPosition) return; // No ball positioned yet

    // Capture the start position
    const startProximity = calculateProximity(pinPosition, ballPosition);
    const startDistance = distance;

    if (made) {
      // Ball went in the hole - record to pending putts
      const endProximity = { horizontal: 0, vertical: 0 };
      const endDistance = 0;

      const putt: PuttingAttempt = {
        timestamp: new Date().toISOString(),
        distance: startDistance,
        distanceUnit: 'metres',
        made: true,
        proximity: endProximity,
        startProximity: startProximity,
        pinPosition: { x: pinPosition.x, y: pinPosition.y },
        puttNumber,
        holeNumber: hole,
        course: NEANGAR_PARK.name,
      };

      // Add to pending putts (will be saved at end of round)
      setPendingPutts([...pendingPutts, putt]);

      // Update the partial entry to mark it as made
      const updatedHistory = [...puttHistory];
      const lastPuttIndex = updatedHistory.length - 1;

      updatedHistory[lastPuttIndex] = {
        puttNum: puttNumber,
        distance: startDistance,
        startProximity,
        endProximity,
        endDistance,
        made: true
      };

      setPuttHistory(updatedHistory);

      setHoleComplete(true);
      setPuttStartProximity(null);
      setPuttStartDistance(0);
      // Reset zoom and pan to default position
      setCanvasZoom(2.2);
      setViewBoxOffset({ x: 0, y: 0 });

      // Don't save yet - putts remain pending until end of round
    } else {
      // Missed - save start position and wait for user to position end
      setPuttStartProximity(startProximity);
      setPuttStartDistance(startDistance);
      setWaitingForEndPosition(true);
      // Partial entry already exists, no need to create a new one
    }
  };

  const formatProximityDescription = (proximity: any): string => {
    if (!proximity) return '';

    const vertDesc = Math.abs(proximity.vertical) < 0.1
      ? ''
      : proximity.vertical > 0
        ? `${Math.abs(proximity.vertical).toFixed(1)}m long`
        : `${Math.abs(proximity.vertical).toFixed(1)}m short`;

    const horizDesc = Math.abs(proximity.horizontal) < 0.1
      ? ''
      : proximity.horizontal > 0
        ? `${Math.abs(proximity.horizontal).toFixed(1)}m right`
        : `${Math.abs(proximity.horizontal).toFixed(1)}m left`;

    if (vertDesc && horizDesc) return `${vertDesc}, ${horizDesc}`;
    return vertDesc || horizDesc || 'at pin';
  };

  const formatProximitySimple = (proximity: any, distance: number): string => {
    if (!proximity || (Math.abs(proximity.horizontal) < 0.1 && Math.abs(proximity.vertical) < 0.1)) {
      return `${distance.toFixed(1)}m`;
    }

    // Calculate angle from pin to ball position (for start position)
    // proximity.vertical is positive when LONG (past hole), negative when SHORT
    // proximity.horizontal is positive when RIGHT, negative when LEFT
    const angleRad = Math.atan2(proximity.vertical, proximity.horizontal);
    const angleDeg = (angleRad * 180 / Math.PI);

    // Determine quadrant based on 45-degree divisions:
    // Right: -45° to 45°
    // Long: 45° to 135°
    // Left: 135° to -135° (or 135° to 225°)
    // Short: -135° to -45° (or 225° to 315°)

    if (angleDeg >= -45 && angleDeg < 45) {
      return `${distance.toFixed(1)}m right`;
    } else if (angleDeg >= 45 && angleDeg < 135) {
      return `${distance.toFixed(1)}m long`;
    } else if (angleDeg >= 135 || angleDeg < -135) {
      return `${distance.toFixed(1)}m left`;
    } else {
      // angleDeg >= -135 && angleDeg < -45
      return `${distance.toFixed(1)}m short`;
    }
  };

  const formatMissDirection = (startProximity: any, endProximity: any, endDistance: number): string => {
    if (!startProximity || !endProximity) {
      return formatProximitySimple(endProximity, endDistance);
    }

    const startDistance = Math.sqrt(
      startProximity.horizontal * startProximity.horizontal +
      startProximity.vertical * startProximity.vertical
    );

    // If ball barely moved, just show end position
    const movement = startDistance - endDistance;
    if (Math.abs(movement) < 0.2) {
      return formatProximitySimple(endProximity, endDistance);
    }

    // NEW APPROACH: Rotate coordinate system so start position is at 180° (6 o'clock)
    // This makes the quadrants relative to where we're putting FROM

    // Get the angle from pin to START position (this becomes our reference 0°)
    const startAngle = Math.atan2(startProximity.vertical, startProximity.horizontal);

    // Get the angle from pin to END position
    const endAngle = Math.atan2(endProximity.vertical, endProximity.horizontal);

    // Calculate relative angle: how much did the end position rotate from start?
    // We want 0° to be the pin (straight towards hole from start)
    // So we subtract startAngle and add 180° to make start position = 180°
    let relativeAngle = (endAngle - startAngle) * 180 / Math.PI;

    // Normalize to -180 to 180
    while (relativeAngle > 180) relativeAngle -= 360;
    while (relativeAngle < -180) relativeAngle += 360;

    // Now apply quadrants with start position as reference:
    // -45° to 45° = SHORT (towards pin)
    // 45° to 135° = RIGHT (perpendicular right from target line)
    // 135° to -135° = LONG (past the pin, away from start)
    // -135° to -45° = LEFT (perpendicular left from target line)

    const absRelativeAngle = Math.abs(relativeAngle);

    if (absRelativeAngle > 135) {
      // Ball went to opposite side of pin from where we started - LONG
      return `${endDistance.toFixed(1)}m long`;
    } else if (relativeAngle >= -45 && relativeAngle <= 45) {
      // Ball stayed on line towards pin - SHORT
      return `${endDistance.toFixed(1)}m short`;
    } else if (relativeAngle > 45 && relativeAngle <= 135) {
      // Ball veered to the right of target line
      return `${endDistance.toFixed(1)}m right`;
    } else {
      // Ball veered to the left of target line (-135 to -45)
      return `${endDistance.toFixed(1)}m left`;
    }
  };

  const handleDeletePutt = (indexToDelete: number) => {
    const deletedPuttNumber = puttHistory[indexToDelete]?.puttNum;

    // Remove from pending putts list
    const updatedPendingPutts = pendingPutts.filter(
      p => !(p.holeNumber === hole && p.puttNumber === deletedPuttNumber)
    );
    setPendingPutts(updatedPendingPutts);

    // Special case: deleting the first putt
    if (indexToDelete === 0) {
      const newHistory = puttHistory.slice(1);
      const renumberedHistory = newHistory.map((putt: any, idx: number) => ({
        ...putt,
        puttNum: idx + 1
      }));
      setPuttHistory(renumberedHistory);

      // Update puttNumber to be the next number in sequence
      setPuttNumber(renumberedHistory.length + 1);

      if (puttHistory[indexToDelete]?.made) {
        setHoleComplete(false);
      }

      // Update putt numbers in pending putts for this hole
      const reindexedPendingPutts = updatedPendingPutts.map(p => {
        if (p.holeNumber === hole && p.puttNumber && p.puttNumber > deletedPuttNumber) {
          return { ...p, puttNumber: p.puttNumber - 1 };
        }
        return p;
      });
      setPendingPutts(reindexedPendingPutts);

      return;
    }

    // Deleting middle or last putt - need to reconnect chain
    const newHistory = [...puttHistory];
    const deletedPutt = newHistory[indexToDelete];

    // If not the last putt, we need to reconnect
    if (indexToDelete < puttHistory.length - 1) {
      // Connect previous putt's start to next putt's end
      const prevPutt = newHistory[indexToDelete - 1];
      const nextPutt = newHistory[indexToDelete + 1];

      // Update previous putt to connect to next putt's end position
      newHistory[indexToDelete - 1] = {
        ...prevPutt,
        endProximity: nextPutt.endProximity,
        endDistance: nextPutt.endDistance,
      };
    }

    // Remove the deleted putt
    newHistory.splice(indexToDelete, 1);

    // Renumber all putts
    const renumberedHistory = newHistory.map((putt: any, idx: number) => ({
      ...putt,
      puttNum: idx + 1
    }));

    setPuttHistory(renumberedHistory);

    // Update puttNumber to be the next number in sequence
    setPuttNumber(renumberedHistory.length + 1);

    // If we deleted a holed putt, allow more putts
    if (deletedPutt?.made) {
      setHoleComplete(false);
    }

    // Update putt numbers in pending putts for this hole
    const reindexedPendingPutts = updatedPendingPutts.map(p => {
      if (p.holeNumber === hole && p.puttNumber && p.puttNumber > deletedPuttNumber) {
        return { ...p, puttNumber: p.puttNumber - 1 };
      }
      return p;
    });
    setPendingPutts(reindexedPendingPutts);
  };

  // Save current hole state
  const saveCurrentHoleState = () => {
    const currentState: HoleState = {
      hole,
      puttHistory,
      pinPosition,
      ballPosition,
      distance,
      distanceInputValue,
      puttNumber,
      holeComplete,
      greenScale,
      greenShape,
      canvasZoom,
      viewBoxOffset,
      pendingPutts: [], // Each hole saves its putts to the component-level pendingPutts
    };

    const newHoleStates = new Map(holeStates);
    newHoleStates.set(hole, currentState);
    setHoleStates(newHoleStates);
  };

  // Save all pending putts from the round to Google Sheets
  const handleSaveRound = () => {
    // Collect all pending putts from all holes
    const allPendingPutts = [...pendingPutts];

    // Notify parent that round is complete (before clearing data)
    if (onRoundComplete) {
      const activeRound = ActiveRoundStorage.loadActiveRound();
      onRoundComplete({
        putts: allPendingPutts,
        courseName: activeRound?.courseName || NEANGAR_PARK.name,
        startTimestamp: activeRound?.startTimestamp || new Date().toISOString()
      });
    }

    // Save round to local history (last 10 rounds)
    if (allPendingPutts.length > 0) {
      const activeRoundForHistory = ActiveRoundStorage.loadActiveRound();
      RoundHistory.saveRound(allPendingPutts, activeRoundForHistory?.courseName || NEANGAR_PARK.name);
    }

    // Save all putts to Google Sheets
    allPendingPutts.forEach(p => onAddPutt(p));

    // Clear active round from localStorage after saving
    ActiveRoundStorage.clearActiveRound();

    // Clear pending putts and hole states
    setPendingPutts([]);
    setHoleStates(new Map());

    // Reset to hole 1
    setHole(1);
    resetHoleState();
  };

  const handleDiscardRound = () => {
    // Clear active round from localStorage
    ActiveRoundStorage.clearActiveRound();

    // Clear pending putts and hole states without saving
    setPendingPutts([]);
    setHoleStates(new Map());

    // Reset to hole 1
    setHole(1);
    resetHoleState();
  };

  // Restore hole state
  const restoreHoleState = (holeNumber: number) => {
    const savedState = holeStates.get(holeNumber);

    if (savedState) {
      // Restore all state from saved hole (except pendingPutts which are managed at component level)
      setPuttHistory(savedState.puttHistory);
      setPinPosition(savedState.pinPosition);
      setBallPosition(savedState.ballPosition);
      setDistance(savedState.distance);
      setDistanceInputValue(savedState.distanceInputValue);
      setPuttNumber(savedState.puttNumber);
      setHoleComplete(savedState.holeComplete);
      setGreenScale(savedState.greenScale);
      setGreenShape(savedState.greenShape);
      setCanvasZoom(savedState.canvasZoom);
      setViewBoxOffset(savedState.viewBoxOffset);
      // Don't restore pendingPutts - they're accumulated across all holes
    } else {
      // No saved state, reset to defaults
      resetHoleState();
    }
  };

  // Reset hole state to defaults
  const resetHoleState = () => {
    setPuttNumber(1);
    setPinPosition({ x: 50, y: 50 });
    setBallPosition(null);
    setDistance(5.5);
    setDistanceInputValue('_._');
    setGreenScale(1);
    setGreenShape({ rx: 55, ry: 63 });
    setPuttHistory([]);
    setHoleComplete(false);
    setPuttStartProximity(null);
    setPuttStartDistance(0);
    setWaitingForEndPosition(false);
    setIsAdjustingPin(true);
    setIsAdjustingGreen(false);
    setCanvasZoom(2.2);
    setViewBoxOffset({ x: 0, y: 0 });
    // Don't clear pendingPutts here - they persist across holes until round is saved
  };

  const handleResetHole = () => {
    // Remove pending putts for current hole
    const updatedPendingPutts = pendingPutts.filter(p => p.holeNumber !== hole);
    setPendingPutts(updatedPendingPutts);

    resetHoleState();
    // Remove saved state for current hole
    const newHoleStates = new Map(holeStates);
    newHoleStates.delete(hole);
    setHoleStates(newHoleStates);
  };

  const handleNextHole = () => {
    // Check if we're finishing hole 18
    if (hole === 18 && holeComplete) {
      // Save current hole 18 state first
      saveCurrentHoleState();

      // Check which holes have been played (need to include hole 18 we just saved)
      const playedHoles = new Set(holeStates.keys());
      playedHoles.add(18); // Include current hole

      // Check if all 18 holes are complete
      const allHolesComplete = playedHoles.size === 18;

      if (allHolesComplete) {
        // All holes played - just offer to save round
        const saveRound = window.confirm(
          'All 18 holes complete! Would you like to save the round?'
        );

        if (saveRound) {
          handleSaveRound();
        }
        return;
      } else {
        // Not all holes played - check if front nine needs to be played
        const hasFrontNine = Array.from(playedHoles).some(h => h >= 1 && h <= 9);

        if (!hasFrontNine) {
          // Offer to play front nine or save partial round
          const playFrontNine = window.confirm(
            'Hole 18 complete! Would you like to play the front nine (holes 1-9)?\n\nClick OK to start hole 1, or Cancel to save the round.'
          );

          if (playFrontNine) {
            setHole(1);
            restoreHoleState(1);
          } else {
            handleSaveRound();
          }
        } else {
          // Some holes played but not all - offer to save
          const saveRound = window.confirm(
            `Hole 18 complete! You've played ${playedHoles.size} of 18 holes.\n\nWould you like to save the round?`
          );

          if (saveRound) {
            handleSaveRound();
          }
        }
        return;
      }
    }

    // Save current hole state before navigating
    saveCurrentHoleState();

    const nextHoleNumber = hole + 1;
    setHole(nextHoleNumber);

    // Restore next hole state (or reset if not saved)
    restoreHoleState(nextHoleNumber);
  };

  const handlePreviousHole = () => {
    if (hole > 1) {
      // Save current hole state before navigating
      saveCurrentHoleState();

      const prevHoleNumber = hole - 1;
      setHole(prevHoleNumber);

      // Restore previous hole state
      restoreHoleState(prevHoleNumber);
    }
  };

  const startIncrement = () => {
    moveBallToDistance(Math.min(50, distance + 0.1));
    incrementInterval.current = setInterval(() => {
      setDistance((prev: number) => {
        const newDist = Math.min(50, prev + 0.1);
        moveBallToDistance(newDist);
        return newDist;
      });
    }, 100);
  };

  const startDecrement = () => {
    moveBallToDistance(Math.max(0.1, distance - 0.1));
    decrementInterval.current = setInterval(() => {
      setDistance((prev: number) => {
        const newDist = Math.max(0.1, prev - 0.1);
        moveBallToDistance(newDist);
        return newDist;
      });
    }, 100);
  };

  const stopIncrement = () => {
    if (incrementInterval.current) {
      clearInterval(incrementInterval.current);
      incrementInterval.current = null;
    }
  };

  const stopDecrement = () => {
    if (decrementInterval.current) {
      clearInterval(decrementInterval.current);
      decrementInterval.current = null;
    }
  };

  // Render green shape based on type
  const renderGreenShape = (shape: GreenShape, zoom: number) => {
    // Calculate transform string with optional offset
    const offsetX = shape.offsetX || 0;
    const offsetY = shape.offsetY || 0;
    const transform = `translate(${offsetX}, ${offsetY}) scale(${1/zoom})`;

    if (shape.type === 'svg' && shape.svgPath) {
      return (
        <>
          {/* Fringe layer - either explicit or auto-generated */}
          {shape.fringePath ? (
            <path
              d={shape.fringePath}
              fill="#145d3d"
              opacity={0.5}
              transform={transform}
            />
          ) : (
            // Auto-generate fringe using SVG stroke for uniform width
            <g transform={`translate(${offsetX}, ${offsetY}) scale(${1/zoom})`}>
              <path
                d={shape.svgPath}
                fill="#145d3d"
                stroke="#145d3d"
                strokeWidth={20}
                opacity={0.5}
              />
            </g>
          )}

          {/* Main green */}
          <path
            d={shape.svgPath}
            fill="#1a7a52"
            opacity={0.4}
            transform={transform}
          />
        </>
      );
    } else if (shape.type === 'polygon' && shape.polygon) {
      const pathString = GreenShapeImporter.polygonToPath(shape.polygon);
      return (
        <>
          {/* Fringe layer (if provided) */}
          {shape.fringePolygon && (
            <path
              d={GreenShapeImporter.polygonToPath(shape.fringePolygon)}
              fill="#145d3d"
              opacity={0.5}
              transform={transform}
            />
          )}

          {/* Main green */}
          <path
            d={pathString}
            fill="#1a7a52"
            opacity={0.4}
            transform={transform}
          />
        </>
      );
    } else if (shape.type === 'ellipse' && shape.ellipse) {
      // Render legacy ellipse using existing Bézier curves
      return (
        <>
          {/* Fringe - organic golf green shape with buffer */}
          <path
            d={`M ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 1.15} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 0.3}
                C ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 1.2} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 0.7}
                  ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 0.6} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 1.15}
                  ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 0.2} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 1.2}
                C ${50 + ((shape.ellipse.rx * greenScale) / zoom) * 0.3} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 1.25}
                  ${50 + ((shape.ellipse.rx * greenScale) / zoom) * 0.8} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 1.1}
                  ${50 + ((shape.ellipse.rx * greenScale) / zoom) * 1.15} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 0.6}
                C ${50 + ((shape.ellipse.rx * greenScale) / zoom) * 1.25} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 0.2}
                  ${50 + ((shape.ellipse.rx * greenScale) / zoom) * 1.2} ${50 + ((shape.ellipse.ry * greenScale) / zoom) * 0.4}
                  ${50 + ((shape.ellipse.rx * greenScale) / zoom) * 1.1} ${50 + ((shape.ellipse.ry * greenScale) / zoom) * 0.8}
                C ${50 + ((shape.ellipse.rx * greenScale) / zoom) * 0.95} ${50 + ((shape.ellipse.ry * greenScale) / zoom) * 1.15}
                  ${50 + ((shape.ellipse.rx * greenScale) / zoom) * 0.3} ${50 + ((shape.ellipse.ry * greenScale) / zoom) * 1.2}
                  ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 0.1} ${50 + ((shape.ellipse.ry * greenScale) / zoom) * 1.15}
                C ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 0.6} ${50 + ((shape.ellipse.ry * greenScale) / zoom) * 1.1}
                  ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 1.1} ${50 + ((shape.ellipse.ry * greenScale) / zoom) * 0.6}
                  ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 1.2} ${50 + ((shape.ellipse.ry * greenScale) / zoom) * 0.1}
                C ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 1.25} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 0.1}
                  ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 1.15} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 0.3}
                  ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 1.15} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 0.3}
                Z`}
            fill="#145d3d"
            opacity="0.5"
          />

          {/* Green - organic natural shape */}
          <path
            d={`M ${50 - ((shape.ellipse.rx * greenScale) / zoom)} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 0.3}
                C ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 1.05} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 0.65}
                  ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 0.55} ${50 - ((shape.ellipse.ry * greenScale) / zoom)}
                  ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 0.15} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 1.05}
                C ${50 + ((shape.ellipse.rx * greenScale) / zoom) * 0.25} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 1.1}
                  ${50 + ((shape.ellipse.rx * greenScale) / zoom) * 0.75} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 0.95}
                  ${50 + ((shape.ellipse.rx * greenScale) / zoom)} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 0.55}
                C ${50 + ((shape.ellipse.rx * greenScale) / zoom) * 1.1} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 0.15}
                  ${50 + ((shape.ellipse.rx * greenScale) / zoom) * 1.05} ${50 + ((shape.ellipse.ry * greenScale) / zoom) * 0.35}
                  ${50 + ((shape.ellipse.rx * greenScale) / zoom) * 0.95} ${50 + ((shape.ellipse.ry * greenScale) / zoom) * 0.75}
                C ${50 + ((shape.ellipse.rx * greenScale) / zoom) * 0.85} ${50 + ((shape.ellipse.ry * greenScale) / zoom)}
                  ${50 + ((shape.ellipse.rx * greenScale) / zoom) * 0.25} ${50 + ((shape.ellipse.ry * greenScale) / zoom) * 1.05}
                  ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 0.05} ${50 + ((shape.ellipse.ry * greenScale) / zoom)}
                C ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 0.55} ${50 + ((shape.ellipse.ry * greenScale) / zoom) * 0.95}
                  ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 0.95} ${50 + ((shape.ellipse.ry * greenScale) / zoom) * 0.55}
                  ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 1.05} ${50 + ((shape.ellipse.ry * greenScale) / zoom) * 0.05}
                C ${50 - ((shape.ellipse.rx * greenScale) / zoom) * 1.1} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 0.1}
                  ${50 - ((shape.ellipse.rx * greenScale) / zoom)} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 0.3}
                  ${50 - ((shape.ellipse.rx * greenScale) / zoom)} ${50 - ((shape.ellipse.ry * greenScale) / zoom) * 0.3}
                Z`}
            fill="#1a7a52"
            opacity="0.4"
          />
        </>
      );
    }
    return null;
  };

  return (
    <>
    <div className="putt-entry-compact">
      {/* Compact Header */}
      <div className="compact-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button className="back-button" onClick={onNavigateHome}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="hole-info-compact">
            <span className="hole-number">Hole {hole}</span>
            <span className="hole-meta">Par {par} · {holeDistance}m</span>
          </div>
          <button
            onClick={() => setShowHoleSelector(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              minWidth: '24px'
            }}
            aria-label="Select hole"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
        <div className="hole-navigation-header">
          <button
            className="hole-nav-btn-header"
            onClick={handlePreviousHole}
            disabled={hole <= 1}
          >
            Previous
          </button>
          <button
            className="hole-nav-btn-header"
            onClick={handleNextHole}
            disabled={!holeComplete && hole >= 18}
          >
            {hole === 18 && holeComplete ? 'End Round' : 'Next'}
          </button>
        </div>
      </div>

      {/* Green Visualisation - More Compact */}
      <div className="green-container-compact">
        <div className="green-wrapper-grid">
          {/* Outcome/Pin buttons overlaid on canvas bottom-right - only show when appropriate */}
          <div className="canvas-outcome-controls-overlay">
            {holeComplete ? (
              <button
                className="canvas-outcome-btn"
                onClick={handleResetHole}
              >
                Reset
              </button>
            ) : isAdjustingPin ? null : waitingForEndPosition ? null : ballPosition ? (
              <>
                <button
                  className="canvas-outcome-btn missed"
                  onClick={() => handlePuttOutcome(false)}
                >
                  Missed it!
                </button>
                <button
                  className="canvas-outcome-btn holed"
                  onClick={() => handlePuttOutcome(true)}
                >
                  Holed it!
                </button>
                {puttHistory.length === 0 ? (
                  <button
                    className="canvas-outcome-btn"
                    onClick={() => setIsAdjustingPin(true)}
                  >
                    Move Pin
                  </button>
                ) : (
                  <button
                    className="canvas-outcome-btn"
                    onClick={handleResetHole}
                  >
                    Reset
                  </button>
                )}
              </>
            ) : null}
          </div>

          <svg
            ref={greenRef}
            className="green-svg-compact"
            viewBox={`${viewBoxOffset.x} ${viewBoxOffset.y} 100 100`}
            onClick={handleGreenClick}
            style={{ cursor: holeComplete ? 'not-allowed' : (isAdjustingPin ? 'crosshair' : 'pointer') }}
          >
            {/* Grid pattern - infinite static background */}
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#2a2a2a" strokeWidth="0.5"/>
              </pattern>
            </defs>
            {/* Infinite grid - much larger rect centered on viewBox */}
            <rect x="-500" y="-500" width="1100" height="1100" fill="url(#grid)" />

            {/* Green shape - rendered based on course data */}
            {greenShapeData && renderGreenShape(greenShapeData, canvasZoom)}

            {/* BACK label */}
            <text x="50" y="8" textAnchor="middle" fill="#6b7280" fontSize="3" fontWeight="600">BACK</text>

            {/* Putt Chain Visualization */}
            {puttHistory.length > 0 && (
              <g className="putt-chain">
                {puttHistory.map((putt, idx) => {
                  const startPos = proximityToPosition(putt.startProximity);

                  // For partial entries, endProximity is null
                  const isPartial = putt.endProximity === null;
                  const endPos = isPartial ? startPos : proximityToPosition(putt.endProximity);

                  return (
                    <g key={idx}>
                      {/* Only render line if not a partial entry */}
                      {!isPartial && (
                        <line
                          x1={startPos.x}
                          y1={startPos.y}
                          x2={endPos.x}
                          y2={endPos.y}
                          stroke={putt.made ? "#22c55e" : "gray"}
                          strokeWidth="0.6"
                          strokeLinecap="round"
                          opacity="0.8"
                        />
                      )}
                      {/* Start position marker (small circle) */}
                      <circle
                        cx={startPos.x}
                        cy={startPos.y}
                        r="1.4"
                        fill={idx === 0 ? "gray" : "#3b82f6"}
                        opacity="0.9"
                      />
                      {/* End position marker - only for complete putts */}
                      {!isPartial && (
                        putt.made ? (
                          // Holed - show at pin position
                          <circle
                            cx={pinPosition.x}
                            cy={pinPosition.y}
                            r="0.8"
                            fill="#22c55e"
                            opacity="0.9"
                          />
                        ) : (
                          // Missed - show end position
                          <circle
                            cx={endPos.x}
                            cy={endPos.y}
                            r="0.6"
                            fill="#3b82f6"
                            opacity="0.9"
                          />
                        )
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* Pin with Lucide flag icon - scales with zoom - only show after pin is placed */}
            {!isAdjustingPin && (
              <g transform={`translate(${pinPosition.x}, ${pinPosition.y}) scale(${1 / canvasZoom})`}>
                {/* Hole */}
                <circle cx="0" cy="0" r="2.4" fill="#141414" stroke="#6b7280" strokeWidth="0.3"/>
                {/* Flag - simplified icon-style */}
                <g transform="translate(-3, -10) scale(0.4)">
                  <path d="M8 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 22v-7" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
                </g>
              </g>
            )}

            {/* Ball - only show when positioned */}
            {ballPosition && (
              <>
                <circle
                  cx={ballPosition.x}
                  cy={ballPosition.y}
                  r="1.5"
                  fill="white"
                  stroke="#000"
                  strokeWidth="0.2"
                />

                {/* Distance line */}
                <line
                  x1={pinPosition.x}
                  y1={pinPosition.y}
                  x2={ballPosition.x}
                  y2={ballPosition.y}
                  stroke="#9ca3af"
                  strokeWidth="0.3"
                  strokeDasharray="1,1"
                  opacity="0.5"
                />
              </>
            )}
          </svg>
        </div>
      </div>

      {/* Compact Controls */}
      <div className="controls-compact">
        <div className="controls-scrollable">
        <div className="putt-info-row">
          <span className={holeComplete ? 'putt-label holed' : 'putt-label'}>
            {holeComplete
              ? 'Holed ✓'
              : waitingForEndPosition
                ? 'Set end position'
                : isAdjustingPin
                  ? 'Set the pin position'
                  : !ballPosition
                    ? 'Set start position'
                    : `Putt ${puttNumber}: did you make it?`}
          </span>
          {!holeComplete && (
            <div className="distance-display-compact" onClick={() => {
              const input = document.getElementById('distance-input') as HTMLInputElement;
              if (input) input.focus();
            }}>
              <input
                id="distance-input"
                type="text"
                inputMode="decimal"
                value={distanceInputValue}
                onChange={(e) => {
                  // Just update the input value, don't move the ball
                  setDistanceInputValue(e.target.value);
                }}
                onBlur={(e: any) => {
                  // Update ball position when user finishes editing
                  const newDistance = parseFloat(e.target.value);
                  if (!isNaN(newDistance) && newDistance >= 0.1 && newDistance <= 50) {
                    moveBallToDistance(newDistance);
                    setDistanceInputValue(newDistance.toFixed(1));
                  } else {
                    // Invalid input, revert to placeholder
                    setDistanceInputValue('_._');
                  }
                }}
                onFocus={(e: any) => {
                  // Select all text when focused for easy editing
                  e.target.select();
                }}
                className="distance-value-input"
              />
              <span className="distance-unit-compact">m</span>
            </div>
          )}
        </div>


        {/* Distance Controls */}
        {!holeComplete && (
        <div className="distance-controls">
          <button
            className={Math.abs(distance - TAP_IN_DISTANCE) < 0.1 ? 'tap-in-btn active' : 'tap-in-btn'}
            onClick={() => moveBallToDistance(TAP_IN_DISTANCE)}
          >
            Tap-in
          </button>
          <button
            className="distance-adjust-btn"
            onMouseDown={startDecrement}
            onMouseUp={stopDecrement}
            onMouseLeave={stopDecrement}
            onTouchStart={startDecrement}
            onTouchEnd={stopDecrement}
          >
            −
          </button>
          <div className="distance-slider-group">
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={Math.min(20, distance)}
              onChange={(e) => moveBallToDistance(parseFloat(e.target.value))}
              className="distance-slider"
            />
          </div>
          <button
            className="distance-adjust-btn"
            onMouseDown={startIncrement}
            onMouseUp={stopIncrement}
            onMouseLeave={stopIncrement}
            onTouchStart={startIncrement}
            onTouchEnd={stopIncrement}
          >
            +
          </button>
        </div>
        )}

        {/* Putt History */}
        <div className="putt-history-compact">
          {puttHistory.length === 0 ? (
            <div className="putt-history-placeholder">
              Record your putting
            </div>
          ) : (
            puttHistory.map((putt, idx) => {
              // For the first putt, calculate start descriptor
              // For subsequent putts, use the previous putt's end descriptor
              const startDescriptor = idx === 0
                ? formatProximitySimple(putt.startProximity, putt.distance)
                : formatMissDirection(puttHistory[idx - 1].startProximity, puttHistory[idx - 1].endProximity, puttHistory[idx - 1].endDistance);

              return (
                <div key={idx} className="putt-history-item">
                  <span className="putt-history-num">Putt {putt.puttNum}:</span>
                  <span className="putt-history-desc">
                    {putt.made
                      ? `Holed from ${putt.distance.toFixed(1)}m`
                      : putt.endProximity === null
                        ? `From ${putt.distance.toFixed(1)}m ...`
                        : `From ${startDescriptor} to ${formatMissDirection(putt.startProximity, putt.endProximity, putt.endDistance)}`}
                  </span>
                  <button
                    className="putt-history-delete"
                    onClick={() => handleDeletePutt(idx)}
                    aria-label="Delete putt"
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>
        </div>
      </div>
    </div>

    {/* Hole Selector Modal */}
    {showHoleSelector && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          padding: '1rem'
        }}
        onClick={() => setShowHoleSelector(false)}
      >
        <div
          style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            maxWidth: '600px',
            width: '100%',
            margin: '2rem auto'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ color: '#fff', marginBottom: '0.75rem', fontSize: '1rem' }}>Go to hole</h2>
          <hr style={{ marginBottom: '1rem', borderColor: '#3a3a3a' }}/>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            {NEANGAR_PARK.holes.map((holeData) => (
              <button
                key={holeData.number}
                onClick={() => {
                  saveCurrentHoleState();
                  setHole(holeData.number);
                  restoreHoleState(holeData.number);
                  setShowHoleSelector(false);
                }}
                style={{
                  backgroundColor: hole === holeData.number ? '#3a3a3a' : '#2a2a2a',
                  border: hole === holeData.number ? '2px solid #4a4a4a' : '1px solid #3a3a3a',
                  borderRadius: '0.5rem',
                  padding: '0.625rem',
                  cursor: 'pointer',
                  color: '#fff',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                  Hole {holeData.number}
                </div>
                <div style={{ fontSize: '0.6rem', color: '#999' }}>
                  Par {holeData.par} · {holeData.distance}m
                </div>
              </button>
            ))}
          </div>

          <hr style={{ marginBottom: '1rem', borderColor: '#3a3a3a' }}/>

          {/* Action buttons */}
          <div style={{
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: '1fr 1fr 1fr'
          }}>
            <button
              className="home-round-action-button home-round-view-button"
              style={{
                gridColumn: 'span 2'
              }}
              onClick={() => {
                setShowHoleSelector(false);
                handleSaveRound();
              }}
            >
              <Flag size={18} />
              Finish Round
            </button>
            <button
              className="home-round-action-button home-delete-button"
              onClick={() => {
                if (window.confirm('Are you sure you want to discard this round? All data will be lost.')) {
                  setShowHoleSelector(false);
                  handleDiscardRound();
                  if (onDiscardRound) {
                    onDiscardRound();
                  }
                }
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
