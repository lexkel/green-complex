'use client';

import { useState, useRef, useEffect } from 'react';
import { Flag, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
import { PuttingAttempt } from '@/types';
import { NEANGAR_PARK, COURSES, getHoleData, GreenShape, HoleData, CourseData } from '@/data/courses';
import { RoundHistory } from '@/lib/roundHistory';
import { ActiveRoundStorage, ActiveRoundData, HoleState as ActiveHoleState } from '@/lib/activeRound';
import { GreenShapeImporter } from '@/lib/greenShapeImporter';
import { DataAccess } from '@/lib/dataAccess';

interface PuttEntryProps {
  onAddPutt: (putt: PuttingAttempt) => void;
  isOnline: boolean;
  onRoundStateChange?: (pendingCount: number, holesComplete: number, saveRound: () => void, getRoundData: () => {putts: PuttingAttempt[], courseName: string, startTimestamp: string}) => void;
  onRoundComplete?: (roundData: {putts: PuttingAttempt[], courseName: string, startTimestamp: string}) => void;
  resetRound?: boolean; // Trigger to reset the entire round
  onNavigationAttempt?: (targetTab: 'home' | 'entry' | 'stats') => void; // Callback to navigate with edit check
  onDiscardRound?: () => void; // Callback when round is discarded
  courseId?: string; // Course ID to use for this round
  isEditingRound?: boolean; // True when editing an existing round (prevents duplicate saves)
  isViewOnly?: boolean; // True when viewing a historical round (read-only, no edits allowed)
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


export function PuttEntry({ onAddPutt, isOnline, onRoundStateChange, onRoundComplete, resetRound, onNavigationAttempt, onDiscardRound, courseId: propCourseId, isEditingRound, isViewOnly = false }: PuttEntryProps) {
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

  // End round confirmation modal
  const [showEndRoundConfirm, setShowEndRoundConfirm] = useState(false);

  // Discard round confirmation modal
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Custom courses from IndexedDB
  const [customCourses, setCustomCourses] = useState<CourseData[]>([]);

  // Current hole data (needs to be in state to react to customCourses changes)
  const [currentHoleData, setCurrentHoleData] = useState<HoleData | undefined>(undefined);

  // Load custom courses from IndexedDB on mount
  useEffect(() => {
    const loadCustomCourses = async () => {
      try {
        const courses = await DataAccess.getCourses();
        const formattedCourses: CourseData[] = courses.map(c => ({
          id: c.id,
          name: c.name,
          holes: JSON.parse(c.holes),
          greenShapes: c.greenShapes ? JSON.parse(c.greenShapes) : undefined,
        }));
        setCustomCourses(formattedCourses);
      } catch (error) {
        console.error('[PuttEntry] Error loading custom courses:', error);
      }
    };
    loadCustomCourses();
  }, []);

  // Update courseId when prop changes
  useEffect(() => {
    if (propCourseId) {
      setCourseId(propCourseId);
    }
  }, [propCourseId]);

  // Update current hole data when hole, courseId, or customCourses change
  useEffect(() => {
    // First try built-in courses
    let holeData = getHoleData(courseId, hole);

    // If not found, try custom courses from IndexedDB (loaded in state)
    if (!holeData) {
      const course = customCourses.find(c => c.id === courseId);
      holeData = course?.holes.find(h => h.number === hole);
    }

    setCurrentHoleData(holeData);
  }, [hole, courseId, customCourses]);

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

        // If there are putts in history, pin has already been placed
        if (currentHoleState.puttHistory.length > 0) {
          setIsAdjustingPin(false);
        }
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

  const par = currentHoleData?.par || 4;
  const holeDistance = currentHoleData?.distance || 0;

  // Load green shape from course data when hole changes
  useEffect(() => {
    if (currentHoleData?.greenShape) {
      setGreenShapeData(currentHoleData.greenShape);
    } else {
      // Fallback to default ellipse for backward compatibility
      setGreenShapeData(GreenShapeImporter.createDefaultEllipse());
    }
  }, [currentHoleData]);

  const [holeComplete, setHoleComplete] = useState(false);
  const [distanceInputValue, setDistanceInputValue] = useState<string>('_._');
  const [isEditingDistance, setIsEditingDistance] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [puttStartProximity, setPuttStartProximity] = useState<any>(null);
  const [puttStartDistance, setPuttStartDistance] = useState<number>(0);
  const [waitingForEndPosition, setWaitingForEndPosition] = useState(false);
  const greenRef = useRef<SVGSVGElement>(null);
  const prevZoomRef = useRef<number>(canvasZoom);
  const [isPinching, setIsPinching] = useState(false);
  const initialPinchDistance = useRef<number>(0);
  const initialZoom = useRef<number>(canvasZoom);
  const pinchCenter = useRef<Position>({ x: 0, y: 0 }); // Center point of pinch in screen coords
  const pinchCenterViewBox = useRef<Position>({ x: 0, y: 0 }); // Center point in viewBox coords
  const incrementInterval = useRef<NodeJS.Timeout | null>(null);
  const decrementInterval = useRef<NodeJS.Timeout | null>(null);
  const [viewBoxOffset, setViewBoxOffset] = useState<Position>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartPos = useRef<Position>({ x: 0, y: 0 });
  const panStartOffset = useRef<Position>({ x: 0, y: 0 });
  const [isMousePanning, setIsMousePanning] = useState(false);
  const hasMousePanned = useRef<boolean>(false);

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

      // Calculate pinch center in screen coordinates
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      pinchCenter.current = { x: centerX, y: centerY };

      // Convert pinch center to viewBox coordinates
      const rect = svg.getBoundingClientRect();
      const svgX = ((centerX - rect.left) / rect.width) * 100;
      const svgY = ((centerY - rect.top) / rect.height) * 100;
      pinchCenterViewBox.current = {
        x: svgX + viewBoxOffset.x,
        y: svgY + viewBoxOffset.y
      };

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

      // Calculate new viewBox offset to keep pinch center stable
      // The pinch center should remain at the same position in viewBox coordinates
      const rect = svg.getBoundingClientRect();
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      const svgX = ((centerX - rect.left) / rect.width) * 100;
      const svgY = ((centerY - rect.top) / rect.height) * 100;

      // Adjust offset so pinchCenterViewBox maps to the current screen position
      const newOffset = {
        x: pinchCenterViewBox.current.x - svgX,
        y: pinchCenterViewBox.current.y - svgY
      };

      setCanvasZoom(newZoom);
      setViewBoxOffset(newOffset);
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

  // Mouse event handlers for desktop panning
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Only pan with left mouse button
    if (e.button !== 0) return;

    // Don't start panning if we're clicking to place pin/ball
    if (isAdjustingPin || !ballPosition || holeComplete) return;

    setIsMousePanning(true);
    hasMousePanned.current = false; // Reset the flag
    panStartPos.current = {
      x: e.clientX,
      y: e.clientY
    };
    panStartOffset.current = { ...viewBoxOffset };
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isMousePanning) return;

    const svg = greenRef.current;
    if (!svg) return;

    const deltaX = e.clientX - panStartPos.current.x;
    const deltaY = e.clientY - panStartPos.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // If moved more than 5 pixels, mark as panned
    if (distance > 5) {
      hasMousePanned.current = true;
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
  };

  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isMousePanning) {
      setIsMousePanning(false);
      e.preventDefault();
      if (hasMousePanned.current) {
        e.stopPropagation(); // Prevent click event from firing only if user actually panned
      }
    }
  };

  const handleMouseLeave = () => {
    if (isMousePanning) {
      setIsMousePanning(false);
      hasMousePanned.current = false;
    }
  };

  const handleGreenClick = (e: React.MouseEvent<SVGSVGElement>) => {
    // Don't handle click if user just finished panning
    if (hasMousePanned.current) {
      hasMousePanned.current = false;
      return;
    }

    if (!greenRef.current || isPinching || isPanning || isMousePanning) return;

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

    // Calculate miss direction for storage
    const missDirection = calculateMissDirectionValue(
      puttStartProximity.horizontal,
      puttStartProximity.vertical,
      endProximity.horizontal,
      endProximity.vertical
    );

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
      course: currentHoleData?.courseName || 'Unknown',
      missDirection: missDirection,
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
        course: currentHoleData?.courseName || 'Unknown',
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

  // Calculate miss direction value for storage
  const calculateMissDirectionValue = (startX: number, startY: number, endX: number, endY: number): 'short' | 'long' | 'left' | 'right' => {
    const dx = endX - startX;
    const dy = endY - startY;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const normalizedAngle = (angle + 360) % 360;

    // Determine primary direction based on angle
    if (normalizedAngle >= 315 || normalizedAngle < 45) {
      return 'right';
    } else if (normalizedAngle >= 45 && normalizedAngle < 135) {
      return 'long';
    } else if (normalizedAngle >= 135 && normalizedAngle < 225) {
      return 'left';
    } else {
      return 'short';
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

    // Only save to RoundHistory if NOT editing (prevents duplicates when editing)
    if (allPendingPutts.length > 0 && !isEditingRound) {
      const activeRoundForHistory = ActiveRoundStorage.loadActiveRound();
      RoundHistory.saveRound(allPendingPutts, activeRoundForHistory?.courseName || NEANGAR_PARK.name);
    }

    // Notify parent that round is complete
    // When editing, parent will intercept this and show confirmation dialog
    // When creating new round, parent will show round summary
    if (onRoundComplete) {
      const activeRound = ActiveRoundStorage.loadActiveRound();
      onRoundComplete({
        putts: allPendingPutts,
        courseName: activeRound?.courseName || NEANGAR_PARK.name,
        startTimestamp: activeRound?.startTimestamp || new Date().toISOString()
      });
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

      // If there are putts in history, pin has already been placed
      if (savedState.puttHistory.length > 0) {
        setIsAdjustingPin(false);
      }
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

  const handleContinueToNextHole = () => {
    // Simple handler: save current hole and go to next hole
    // Used by the secondary continue button on hole 18
    saveCurrentHoleState();

    // Go to next hole, wrapping from 18 to 1
    const nextHole = hole === 18 ? 1 : hole + 1;
    setHole(nextHole);
    restoreHoleState(nextHole);
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
    if (isAdjusting) return; // Prevent double-firing
    setIsAdjusting(true);

    // If editing distance, exit edit mode first
    if (isEditingDistance) {
      setIsEditingDistance(false);
    }

    // Single increment on press
    const newDist = Math.min(50, distance + 0.1);
    moveBallToDistance(newDist);
    setDistanceInputValue(newDist.toFixed(1));

    // Delay before continuous increment starts (prevents accidental double-tap)
    incrementInterval.current = setTimeout(() => {
      incrementInterval.current = setInterval(() => {
        setDistance((prev: number) => {
          const newDist = Math.min(50, prev + 0.1);
          moveBallToDistance(newDist);
          setDistanceInputValue(newDist.toFixed(1));
          return newDist;
        });
      }, 150) as any; // Slower interval for better control
    }, 300) as any; // 300ms delay before continuous increment
  };

  const startDecrement = () => {
    if (isAdjusting) return; // Prevent double-firing
    setIsAdjusting(true);

    // If editing distance, exit edit mode first
    if (isEditingDistance) {
      setIsEditingDistance(false);
    }

    // Single decrement on press
    const newDist = Math.max(0.1, distance - 0.1);
    moveBallToDistance(newDist);
    setDistanceInputValue(newDist.toFixed(1));

    // Delay before continuous decrement starts
    decrementInterval.current = setTimeout(() => {
      decrementInterval.current = setInterval(() => {
        setDistance((prev: number) => {
          const newDist = Math.max(0.1, prev - 0.1);
          moveBallToDistance(newDist);
          setDistanceInputValue(newDist.toFixed(1));
          return newDist;
        });
      }, 150) as any;
    }, 300) as any;
  };

  const stopIncrement = () => {
    if (incrementInterval.current) {
      clearInterval(incrementInterval.current);
      clearTimeout(incrementInterval.current); // Also clear timeout if still waiting
      incrementInterval.current = null;
    }
    setIsAdjusting(false);
  };

  const stopDecrement = () => {
    if (decrementInterval.current) {
      clearInterval(decrementInterval.current);
      clearTimeout(decrementInterval.current); // Also clear timeout if still waiting
      decrementInterval.current = null;
    }
    setIsAdjusting(false);
  };

  // Render green shape based on type
  const renderGreenShape = (shape: GreenShape, zoom: number) => {
    // Calculate the actual center of the shape from its bounds
    let centerX = 50;
    let centerY = 50;

    if (shape.bounds) {
      centerX = (shape.bounds.minX + shape.bounds.maxX) / 2;
      centerY = (shape.bounds.minY + shape.bounds.maxY) / 2;
    }

    // Apply manual offset if provided
    const offsetX = shape.offsetX || 0;
    const offsetY = shape.offsetY || 0;

    // Transform: move to canvas center (50,50), apply zoom, then move back by shape's actual center
    const transform = `translate(${50 + offsetX}, ${50 + offsetY}) scale(${1/zoom}) translate(${-centerX}, ${-centerY})`;

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
            <g transform={transform}>
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
          <button className="back-button" onClick={() => {
            console.log('[BACK BUTTON] Clicked in PuttEntry');
            console.log('[BACK BUTTON] isViewOnly:', isViewOnly);
            console.log('[BACK BUTTON] isEditingRound:', isEditingRound);
            console.log('[BACK BUTTON] onNavigationAttempt:', onNavigationAttempt);

            // If viewing or editing a round, navigate back to home (which will show round summary)
            // Otherwise, navigate to home normally
            onNavigationAttempt?.('home');
          }}>
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
        {!isViewOnly && !isEditingRound && (
          <div className="hole-navigation-header">
            <button
              className="hole-nav-btn-header"
              style={{gap: '0.5rem'}}
              onClick={() => setShowEndRoundConfirm(true)}
            >
              <Flag size={18} />
              <span style={{color:'#fff'}}>End Round</span>
            </button>
          </div>
        )}
      </div>

      {/* Green Visualisation - More Compact */}
      <div className="green-container-compact">
        <div className="green-wrapper-grid">
          {/* Outcome/Pin buttons overlaid on canvas bottom-right - only show when appropriate */}
          <div className="canvas-outcome-controls-overlay">
            {!isViewOnly && (holeComplete ? (
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
            ) : null)}
          </div>

          {/* Navigation Buttons - positioned on sides, vertically centered */}
          {(() => {
            // In view-only mode, always show prev/next navigation buttons
            if (isViewOnly) {
              return (
                <>
                  {/* Previous button on left side */}
                  {hole > 1 && (
                    <button
                      className="canvas-prev-btn"
                      onClick={handlePreviousHole}
                      aria-label="Previous Hole"
                    >
                      <ChevronLeft size={32} />
                    </button>
                  )}
                  {/* Next button on right side */}
                  {hole < 18 && (
                    <button
                      className="canvas-next-btn"
                      onClick={handleNextHole}
                      aria-label="Next Hole"
                    >
                      <ChevronRight size={32} />
                    </button>
                  )}
                </>
              );
            }

            // In edit mode, show completion-based navigation (existing behavior)
            // Calculate which holes have been completed
            const completedHolesSet = new Set(
              Array.from(holeStates.values())
                .filter(state => state.holeComplete)
                .map(state => state.hole)
            );
            // Add current hole if it's complete
            if (holeComplete) {
              completedHolesSet.add(hole);
            }

            // Check if all 18 holes are complete
            const allHolesComplete = completedHolesSet.size === 18;

            // On hole 18 (regardless of completion): show dual buttons if not all holes complete
            if (hole === 18 && !allHolesComplete) {
              return (
                <>
                  {/* Smaller Continue button (chevron) - positioned above */}
                  <button
                    className="canvas-next-btn-secondary"
                    onClick={handleContinueToNextHole}
                    aria-label="Continue to next hole"
                  >
                    <ChevronRight size={24} />
                  </button>
                  {/* Larger Finish button (flag) - primary position */}
                  <button
                    className="canvas-next-btn-primary"
                    onClick={() => setShowEndRoundConfirm(true)}
                    aria-label="Finish Round"
                  >
                    <Flag size={32} />
                  </button>
                </>
              );
            }

            // For all other cases: only show button if hole is complete
            if (!holeComplete) {
              return null;
            }

            // Show single button - flag if all holes complete, chevron otherwise
            return (
              <button
                className="canvas-next-btn"
                onClick={allHolesComplete ? () => setShowEndRoundConfirm(true) : handleNextHole}
                aria-label={allHolesComplete ? 'Finish Round' : 'Next Hole'}
              >
                {allHolesComplete ? (
                  <Flag size={32} />
                ) : (
                  <ChevronRight size={32} />
                )}
              </button>
            );
          })()}

          {/* Desktop Zoom Controls - positioned top-right */}
          <div className="canvas-zoom-controls-overlay">
            <button
              className="zoom-control-btn"
              onClick={() => setCanvasZoom(Math.max(0.5, canvasZoom - 0.2))}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              className="zoom-control-btn"
              onClick={() => setCanvasZoom(Math.min(4, canvasZoom + 0.2))}
              aria-label="Zoom out"
            >
              −
            </button>
          </div>

          <svg
            ref={greenRef}
            className="green-svg-compact"
            viewBox={`${viewBoxOffset.x} ${viewBoxOffset.y} 100 100`}
            onClick={isViewOnly || isEditingDistance ? undefined : handleGreenClick}
            onMouseDown={isViewOnly || isEditingDistance ? undefined : handleMouseDown}
            onMouseMove={isViewOnly || isEditingDistance ? undefined : handleMouseMove}
            onMouseUp={isViewOnly || isEditingDistance ? undefined : handleMouseUp}
            onMouseLeave={isViewOnly || isEditingDistance ? undefined : handleMouseLeave}
            style={{
              cursor: isViewOnly ? 'default' : (isEditingDistance ? 'default' : (holeComplete ? 'not-allowed' : (isAdjustingPin ? 'crosshair' : (isMousePanning ? 'grabbing' : 'pointer')))),
              pointerEvents: isViewOnly || isEditingDistance ? 'none' : 'auto',
              opacity: isEditingDistance ? 0.5 : 1,
              transition: 'opacity 0.2s'
            }}
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

            {/* BACK label - fixed position relative to viewport */}
            <text x={viewBoxOffset.x + 50} y={viewBoxOffset.y + 8} textAnchor="middle" fill="#6b7280" fontSize="3" fontWeight="600">BACK</text>

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
                          stroke="white"
                          strokeWidth="0.6"
                          strokeLinecap="round"
                          opacity="0.8"
                        />
                      )}
                      {/* Start position marker (small dot) */}
                      <circle
                        cx={startPos.x}
                        cy={startPos.y}
                        r="0.6"
                        fill="white"
                        opacity="0.9"
                      />
                      {/* End position marker - only for complete putts */}
                      {!isPartial && (
                        // Show small white dot at end position (including holed putts)
                        <circle
                          cx={putt.made ? pinPosition.x : endPos.x}
                          cy={putt.made ? pinPosition.y : endPos.y}
                          r="0.6"
                          fill="white"
                          opacity="0.9"
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* Pin with Lucide flag icon - scales with zoom - only show after pin is placed */}
            {!isAdjustingPin && (
              <>
                {/* Hole - custom scaling: larger when zoomed out, smaller when zoomed in */}
                <g transform={`translate(${pinPosition.x}, ${pinPosition.y}) scale(${Math.pow(1 / canvasZoom, 0.5) * 0.7})`}>
                  <circle cx="0" cy="0" r="2.4" fill="#141414" stroke="#6b7280" strokeWidth="0.3"/>
                </g>

                {/* Flag - maintains current inverse scaling for visibility */}
                <g transform={`translate(${pinPosition.x}, ${pinPosition.y}) scale(${1 / canvasZoom})`}>
                  <g transform="translate(-3, -10) scale(0.4)">
                    <path d="M8 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 22v-7" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
                  </g>
                </g>
              </>
            )}

            {/* Ball - only show when positioned and hole not complete */}
            {ballPosition && !holeComplete && (
              <>
                <circle
                  cx={ballPosition.x}
                  cy={ballPosition.y}
                  r="1.5"
                  fill="white"
                  stroke="#000"
                  strokeWidth="0.2"
                />

                {/* Distance line - dashed white line for active putt */}
                <line
                  x1={pinPosition.x}
                  y1={pinPosition.y}
                  x2={ballPosition.x}
                  y2={ballPosition.y}
                  stroke="white"
                  strokeWidth="0.6"
                  strokeDasharray="2,2"
                  strokeLinecap="round"
                  opacity="0.8"
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
              ? 'Holed'
              : waitingForEndPosition
                ? 'Set end position'
                : isAdjustingPin
                  ? 'Set the pin position'
                  : !ballPosition
                    ? 'Set start position'
                    : `Putt ${puttNumber}: did you make it?`}
          </span>
        </div>


        {/* Distance Controls */}
        {!holeComplete && (
        <div className="distance-controls">
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
          <div className="distance-display-centered" onClick={() => {
            const input = document.getElementById('distance-input') as HTMLInputElement;
            if (input) input.focus();
          }}>
            <input
              id="distance-input"
              type="text"
              inputMode="numeric"
              value={distanceInputValue}
              onChange={(e) => {
                const input = e.target.value;

                // Only allow digits and decimal point
                const cleaned = input.replace(/[^0-9.]/g, '');

                // Prevent multiple decimal points
                const parts = cleaned.split('.');
                if (parts.length > 2) {
                  return; // Invalid, ignore
                }

                // Just store the raw input while typing
                setDistanceInputValue(cleaned);
              }}
              onKeyDown={(e) => {
                // Enter or Tab to save
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
                // Escape to cancel
                else if (e.key === 'Escape') {
                  setDistanceInputValue(distance > 0 ? distance.toFixed(1) : '_._');
                  setIsEditingDistance(false);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onBlur={(e: any) => {
                let finalValue = distanceInputValue.trim();

                // If single digit (e.g., "4"), convert to "0.4"
                if (/^\d$/.test(finalValue)) {
                  finalValue = `0.${finalValue}`;
                }

                const newDistance = parseFloat(finalValue);
                if (!isNaN(newDistance) && newDistance >= 0.1 && newDistance <= 50) {
                  moveBallToDistance(newDistance);
                  setDistanceInputValue(newDistance.toFixed(1));
                } else {
                  // Invalid input, revert to current distance or placeholder
                  setDistanceInputValue(distance > 0 ? distance.toFixed(1) : '_._');
                }
                setIsEditingDistance(false);
              }}
              onFocus={(e: any) => {
                setIsEditingDistance(true);
                // Clear the value and set cursor to start
                setDistanceInputValue('');
                setTimeout(() => {
                  e.target.setSelectionRange(0, 0);
                }, 0);
              }}
              className="distance-value-input-large"
            />
            <span className="distance-unit-large">m</span>
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
              // Calculate the start descriptor for this putt
              const startDescriptor = formatProximitySimple(putt.startProximity, putt.distance);

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
                  {!isViewOnly && (
                    <button
                      className="putt-history-delete"
                      onClick={() => handleDeletePutt(idx)}
                      aria-label="Delete putt"
                    >
                      ×
                    </button>
                  )}
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
                setShowEndRoundConfirm(true);
              }}
            >
              <Flag size={18} />
              End Round
            </button>
            <button
              className="home-round-action-button home-delete-button"
              onClick={() => {
                setShowHoleSelector(false);
                setShowDiscardConfirm(true);
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>
    )}

    {/* End Round Confirmation Dialog */}
    {showEndRoundConfirm && (() => {
      // Calculate how many holes have been played
      const completedHolesSet = new Set(
        Array.from(holeStates.values())
          .filter(state => state.holeComplete)
          .map(state => state.hole)
      );
      // Add current hole if it's complete
      if (holeComplete) {
        completedHolesSet.add(hole);
      }
      const holesPlayed = completedHolesSet.size;

      return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowEndRoundConfirm(false)}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-xl)',
            maxWidth: '400px',
            width: '90%',
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text)' }}>
              End Round?
            </h3>
            <p style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
              You've played {holesPlayed} hole{holesPlayed !== 1 ? 's' : ''}. Do you want to finish the round now?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <button
                onClick={() => {
                  setShowEndRoundConfirm(false);
                  handleSaveRound();
                }}
                className="submit-button"
                style={{ width: '100%' }}
              >
                Yes, Save Round
              </button>
              <button
                onClick={() => setShowEndRoundConfirm(false)}
                className="auth-button"
                style={{ width: '100%', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              >
                Resume Round
              </button>
            </div>
          </div>
        </div>
      );
    })()}

    {/* Discard Round Confirmation Dialog */}
    {showDiscardConfirm && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }} onClick={() => setShowDiscardConfirm(false)}>
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-xl)',
          maxWidth: '400px',
          width: '90%',
        }} onClick={(e) => e.stopPropagation()}>
          <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text)' }}>
            Discard Round?
          </h3>
          <p style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
            Are you sure you want to discard this round? All data will be lost and cannot be recovered.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            <button
              onClick={() => {
                setShowDiscardConfirm(false);
                handleDiscardRound();
                if (onDiscardRound) {
                  onDiscardRound();
                }
              }}
              className="auth-button logout-button"
              style={{ width: '100%' }}
            >
              Yes, Discard Round
            </button>
            <button
              onClick={() => setShowDiscardConfirm(false)}
              className="auth-button"
              style={{ width: '100%', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
