'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth, LoginButton } from '@/components/GoogleAuth';
import { PuttEntry } from '@/components/PuttEntry';
import { StatsDisplay } from '@/components/StatsDisplay';
import { RoundSummary } from '@/components/RoundSummary';
import { GoogleSheetsService } from '@/lib/googleSheets';
import { OfflineStorage } from '@/lib/offlineStorage';
import { RoundHistory, SavedRound } from '@/lib/roundHistory';
import { ActiveRoundStorage } from '@/lib/activeRound';
import { PuttingAttempt } from '@/types';
import { Save, Trash2 } from 'lucide-react';
import { COURSES, CourseData, HoleData } from '@/data/courses';
import { UserIdentity } from '@/lib/userIdentity';
import { DataMigration } from '@/lib/migration';
import { SyncService, SyncStatus } from '@/lib/sync';
import { DataAccess } from '@/lib/dataAccess';

// Sample data for demo mode
const DEMO_PUTTS: PuttingAttempt[] = [
  { timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), distance: 1.5, distanceUnit: 'metres', made: true, conditions: 'fast', course: 'St Andrews' },
  { timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), distance: 3, distanceUnit: 'metres', made: true, conditions: 'fast', course: 'St Andrews' },
  { timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), distance: 5, distanceUnit: 'metres', made: false, conditions: 'fast', course: 'St Andrews' },
  { timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), distance: 2, distanceUnit: 'metres', made: true, conditions: 'fast', course: 'St Andrews' },
  { timestamp: new Date(Date.now() - 86400000).toISOString(), distance: 1, distanceUnit: 'metres', made: true, conditions: 'medium' },
  { timestamp: new Date(Date.now() - 86400000).toISOString(), distance: 2.5, distanceUnit: 'metres', made: true, conditions: 'medium' },
  { timestamp: new Date(Date.now() - 86400000).toISOString(), distance: 4, distanceUnit: 'metres', made: false, conditions: 'medium' },
  { timestamp: new Date(Date.now() - 86400000).toISOString(), distance: 6, distanceUnit: 'metres', made: false, conditions: 'medium' },
  { timestamp: new Date().toISOString(), distance: 1.5, distanceUnit: 'metres', made: true, conditions: 'slow', course: 'Royal Troon' },
  { timestamp: new Date().toISOString(), distance: 3, distanceUnit: 'metres', made: true, conditions: 'slow', course: 'Royal Troon' },
  { timestamp: new Date().toISOString(), distance: 8, distanceUnit: 'metres', made: false, conditions: 'slow', course: 'Royal Troon' },
];

export default function Home() {
  const { accessToken, isAuthenticated, isDemoMode, logout, username } = useAuth();
  const [putts, setPutts] = useState<PuttingAttempt[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState<'metres' | 'feet'>('metres');
  const [activeTab, setActiveTab] = useState<'home' | 'entry' | 'stats' | 'settings'>('home');
  const [showSplashScreen, setShowSplashScreen] = useState(false);
  const [pendingPuttsCount, setPendingPuttsCount] = useState(0);
  const [holesComplete, setHolesComplete] = useState(0);
  const [saveRoundFn, setSaveRoundFn] = useState<(() => void) | null>(null);
  const [getRoundDataFn, setGetRoundDataFn] = useState<(() => {putts: PuttingAttempt[], courseName: string, startTimestamp: string}) | null>(null);
  const [resetRound, setResetRound] = useState(false);
  const [recentRounds, setRecentRounds] = useState<SavedRound[]>([]);
  const [showNewRoundWarning, setShowNewRoundWarning] = useState(false);
  const [pendingCourseSelection, setPendingCourseSelection] = useState<string | null>(null);
  const [activeRoundInfo, setActiveRoundInfo] = useState<{courseName: string, startTime: Date} | null>(null);
  const [showRoundSummary, setShowRoundSummary] = useState(false);
  const [savedRoundData, setSavedRoundData] = useState<{putts: PuttingAttempt[], courseName: string, date: Date, roundId?: string} | null>(null);
  const [isViewingHistoricalRound, setIsViewingHistoricalRound] = useState(false);
  const [openMenuRoundId, setOpenMenuRoundId] = useState<string | null>(null);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [originalRoundPutts, setOriginalRoundPutts] = useState<PuttingAttempt[] | null>(null);
  const [showEditExitConfirmation, setShowEditExitConfirmation] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<'home' | 'entry' | 'stats' | null>(null);
  const [showNewCourseModal, setShowNewCourseModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseHoles, setNewCourseHoles] = useState<Array<{ number: number; par: number; distance: number }>>(
    Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, distance: 350 }))
  );
  const [customCourses, setCustomCourses] = useState<CourseData[]>([]);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseEditMode, setCourseEditMode] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('neangar-park');
  const [recoveryCode, setRecoveryCode] = useState<string>('');
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCode, setImportCode] = useState('');
  const hasInitializedRef = useRef(false);
  const migrationCompleteRef = useRef(false);

  // Initialize user identity and run migration
  useEffect(() => {
    const initUserAndMigrate = async () => {
      // Initialize user identity
      const { id, isNew } = UserIdentity.getUserId();
      console.log('[App] User ID:', id, 'Is new:', isNew);

      // Run migrations from localStorage to IndexedDB
      try {
        await DataMigration.migrateFromLocalStorage();
        await DataMigration.migrateCoursesFromLocalStorage();
        migrationCompleteRef.current = true;
        console.log('[App] Data migration complete');

        // Start automatic sync after migration
        if (navigator.onLine) {
          SyncService.startAutoSync(30000); // Sync every 30 seconds
        }
      } catch (error) {
        console.error('[App] Migration failed:', error);
      }
    };

    initUserAndMigrate();
  }, []);

  useEffect(() => {
    setIsOnline(OfflineStorage.isOnline());

    const handleOnline = () => {
      setIsOnline(true);
      syncPendingPutts();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load recovery code and sync status when on settings tab
  useEffect(() => {
    if (activeTab === 'settings') {
      setRecoveryCode(UserIdentity.getRecoveryCode());
      SyncService.getSyncStatus().then(setSyncStatus);
    }
  }, [activeTab]);

  useEffect(() => {
    console.log('[PAGE] Auth useEffect triggered - isAuthenticated:', isAuthenticated, 'accessToken:', accessToken, 'hasInitialized:', hasInitializedRef.current);
    if (isAuthenticated && accessToken && !hasInitializedRef.current) {
      console.log('[PAGE] Initializing app data');
      hasInitializedRef.current = true;

      const initializeData = async () => {
        if (isDemoMode) {
          // Load demo data
          setPutts(DEMO_PUTTS);
          setIsLoading(false);
        } else if (accessToken === 'simple-auth-token') {
          // Load putts from IndexedDB rounds for simple auth
          const rounds = await RoundHistory.getRounds();
          const allPutts = rounds.flatMap(round => round.putts);
          setPutts(allPutts);
          setIsLoading(false);
        } else {
          loadPutts();
        }
        // Load recent rounds from IndexedDB
        const rounds = await RoundHistory.getRounds();
        setRecentRounds(rounds);

        // Load active round summary for home screen display
        const activeRound = ActiveRoundStorage.getActiveRoundSummary();
        if (activeRound) {
          setPendingPuttsCount(activeRound.totalPutts);
          setHolesComplete(activeRound.holesPlayed);
          setActiveRoundInfo({ courseName: activeRound.courseName, startTime: activeRound.startTime });
        }

        // Load custom courses from IndexedDB
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
          console.error('[App] Error loading courses:', error);
        }
      };

      initializeData();
    }
  }, [isAuthenticated, accessToken, isDemoMode]);

  const loadPutts = async () => {
    if (!accessToken) return;

    // Skip Google Sheets API for simple auth (fake token)
    if (accessToken === 'simple-auth-token') {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const sheetsService = new GoogleSheetsService(accessToken);
      const fetchedPutts = await sheetsService.getAllPutts();
      setPutts(fetchedPutts);
    } catch (error) {
      console.error('Error loading putts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const syncPendingPutts = async () => {
    if (!accessToken || !isOnline) return;

    // Skip Google Sheets sync for simple auth
    if (accessToken === 'simple-auth-token') return;

    const unsyncedPutts = OfflineStorage.getUnsyncedPutts();
    if (unsyncedPutts.length === 0) return;

    try {
      const sheetsService = new GoogleSheetsService(accessToken);
      await sheetsService.addMultiplePutts(unsyncedPutts);

      unsyncedPutts.forEach(putt => {
        OfflineStorage.removeFromQueue(putt.id);
      });

      await loadPutts();
    } catch (error) {
      console.error('Error syncing putts:', error);
    }
  };

  const handleAddPutt = async (putt: PuttingAttempt) => {
    setPutts([...putts, putt]);

    if (!accessToken) return;

    // In demo mode or simple auth, just update local state
    if (isDemoMode || accessToken === 'simple-auth-token') {
      return;
    }

    if (isOnline) {
      try {
        const sheetsService = new GoogleSheetsService(accessToken);
        await sheetsService.addPutt(putt);
      } catch (error) {
        console.error('Error saving putt:', error);
        OfflineStorage.addToQueue(putt);
      }
    } else {
      OfflineStorage.addToQueue(putt);
    }
  };

  const handleSaveNewCourse = async () => {
    if (!newCourseName.trim()) return;

    try {
      if (editingCourseId) {
        // Editing existing course
        await DataAccess.updateCourse(editingCourseId, {
          name: newCourseName,
          holes: newCourseHoles,
        });

        // Update local state
        const updatedCustomCourses = customCourses.map(course =>
          course.id === editingCourseId
            ? { ...course, name: newCourseName, holes: newCourseHoles }
            : course
        );
        setCustomCourses(updatedCustomCourses);
      } else {
        // Creating new course
        const courseId = await DataAccess.saveCourse(
          newCourseName,
          newCourseHoles,
          null
        );

        const newCourse: CourseData = {
          id: courseId,
          name: newCourseName,
          holes: newCourseHoles
        };

        setCustomCourses([...customCourses, newCourse]);
      }

      // Reset form
      setNewCourseName('');
      setNewCourseHoles(Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, distance: 350 })));
      setShowNewCourseModal(false);
      setEditingCourseId(null);
    } catch (error) {
      console.error('[App] Error saving course:', error);
      alert('Failed to save course. Please try again.');
    }
  };

  const handleCancelNewCourse = () => {
    setNewCourseName('');
    setNewCourseHoles(Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, distance: 350 })));
    setShowNewCourseModal(false);
    setEditingCourseId(null);
  };

  const handleEditCourse = (course: CourseData) => {
    setEditingCourseId(course.id);
    setNewCourseName(course.name);
    setNewCourseHoles(course.holes.map(h => ({ number: h.number, par: h.par, distance: h.distance })));
    setShowNewCourseModal(true);
  };

  const handleDeleteCourse = async (courseId: string) => {
    // Check if this is a custom course (all courses in customCourses are now from IndexedDB)
    const customCourse = customCourses.find(c => c.id === courseId);

    if (!customCourse) return;

    try {
      if (confirm('Are you sure you want to delete this course?')) {
        await DataAccess.deleteCourse(courseId);

        const updatedCustomCourses = customCourses.filter(c => c.id !== courseId);
        setCustomCourses(updatedCustomCourses);
      }
    } catch (error) {
      console.error('[App] Error deleting course:', error);
      alert('Failed to delete course. Please try again.');
    }
  };

  const handleHoleDataChange = (index: number, field: 'par' | 'distance', value: string) => {
    const numValue = parseInt(value) || 0;
    const updatedHoles = [...newCourseHoles];
    updatedHoles[index] = { ...updatedHoles[index], [field]: numValue };
    setNewCourseHoles(updatedHoles);
  };

  // Get effective course (checks for custom override of built-in course)
  const getEffectiveCourse = (courseId: string): CourseData => {
    const customOverride = customCourses.find(c => c.id === courseId);
    if (customOverride) return customOverride;

    const builtIn = COURSES.find(c => c.id === courseId);
    return builtIn!;
  };

  // Check if a course has been customized
  const isCustomized = (courseId: string): boolean => {
    return customCourses.some(c => c.id === courseId);
  };

  const handleRoundStateChange = useCallback((count: number, holes: number, saveFn: () => void, getRoundDataFn: () => {putts: PuttingAttempt[], courseName: string, startTimestamp: string}) => {
    setPendingPuttsCount(count);
    setHolesComplete(holes);
    setSaveRoundFn(() => saveFn);
    setGetRoundDataFn(() => getRoundDataFn);
  }, []);

  const handleEndRound = async () => {
    console.log('[HANDLE END ROUND] Called, saveRoundFn:', saveRoundFn, 'getRoundDataFn:', getRoundDataFn);
    if (saveRoundFn && getRoundDataFn) {
      // Get the active round data before saving
      const roundData = getRoundDataFn();
      console.log('[HANDLE END ROUND] Round data:', roundData);

      // Check if we're editing an existing round
      if (editingRoundId && savedRoundData?.roundId) {
        console.log('[HANDLE END ROUND] Updating existing round:', savedRoundData.roundId);

        // Update the existing round (keeps same ID, no duplication)
        await RoundHistory.updateRound(savedRoundData.roundId, {
          putts: roundData.putts,
          course: roundData.courseName,
        });

        // Update savedRoundData with new putts
        setSavedRoundData({
          ...savedRoundData,
          putts: roundData.putts
        });
      } else {
        console.log('[HANDLE END ROUND] Saving new round');

        // Store the round data for the summary screen
        setSavedRoundData({
          putts: roundData.putts,
          courseName: roundData.courseName,
          date: new Date(roundData.startTimestamp)
        });

        // Save the round as new
        saveRoundFn();
      }

      // Clear active round state
      ActiveRoundStorage.clearActiveRound();
      setPendingPuttsCount(0);
      setHolesComplete(0);
      setSaveRoundFn(null);
      setGetRoundDataFn(null);
      setEditingRoundId(null);
      setOriginalRoundPutts(null);

      // Reload recent rounds after saving
      const rounds = await RoundHistory.getRounds();
      setRecentRounds(rounds);
      // Also reload putts for stats
      const allPutts = rounds.flatMap(round => round.putts);
      setPutts(allPutts);

      // Show the round summary
      console.log('[HANDLE END ROUND] Setting showRoundSummary to true');
      setShowRoundSummary(true);
    }
  };

  const handleRoundComplete = (roundData: {putts: PuttingAttempt[], courseName: string, startTimestamp: string}) => {
    console.log('[HANDLE ROUND COMPLETE] Round completed from PuttEntry:', roundData);

    // If we're showing the edit exit confirmation, don't complete the round
    // The user is trying to exit edit mode, not finish the round
    if (showEditExitConfirmation) {
      console.log('[HANDLE ROUND COMPLETE] Edit exit confirmation is showing, ignoring round complete');
      return;
    }

    // If we're in edit mode, don't auto-complete - user should explicitly save
    if (editingRoundId) {
      console.log('[HANDLE ROUND COMPLETE] In edit mode, showing confirmation instead');
      setShowEditExitConfirmation(true);
      return;
    }

    // Store the round data for the summary screen
    setSavedRoundData({
      putts: roundData.putts,
      courseName: roundData.courseName,
      date: new Date(roundData.startTimestamp)
    });

    // Clear the UI state
    setPendingPuttsCount(0);
    setHolesComplete(0);
    setSaveRoundFn(null);
    setGetRoundDataFn(null);

    // Reload recent rounds after saving
    RoundHistory.getRounds().then(rounds => {
      setRecentRounds(rounds);
      // Also reload putts for stats
      const allPutts = rounds.flatMap(round => round.putts);
      setPutts(allPutts);
    });

    // Show the round summary
    console.log('[HANDLE ROUND COMPLETE] Setting showRoundSummary to true');
    setShowRoundSummary(true);
  };

  const handleViewRound = (round: SavedRound) => {
    setSavedRoundData({
      putts: round.putts,
      courseName: round.course,
      date: new Date(round.timestamp),
      roundId: round.id
    });
    setIsViewingHistoricalRound(true);
    setShowRoundSummary(true);
  };

  const handleDeleteRound = async (roundId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (window.confirm('Are you sure you want to delete this round? This action cannot be undone.')) {
      await RoundHistory.deleteRound(roundId);
      const rounds = await RoundHistory.getRounds();
      setRecentRounds(rounds);
      setOpenMenuRoundId(null);

      // Refresh stats by reloading putts from round history
      if (accessToken === 'simple-auth-token' || isDemoMode) {
        const allPutts = rounds.flatMap(round => round.putts);
        setPutts(allPutts);
      }
    }
  };

  const handleEditRoundMetadata = async (courseName: string, date: Date) => {
    if (!savedRoundData?.roundId) return;

    // Update the round in history
    await RoundHistory.updateRound(savedRoundData.roundId, {
      course: courseName,
      timestamp: date.toISOString()
    });

    // Update the savedRoundData state
    setSavedRoundData({
      ...savedRoundData,
      courseName: courseName,
      date: date
    });

    // Reload recent rounds to reflect changes
    const rounds = await RoundHistory.getRounds();
    setRecentRounds(rounds);
  };

  const restoreRoundForEditing = (putts: PuttingAttempt[], courseName: string, startTimestamp: string, targetHole?: number) => {
    // Group putts by hole
    const holeGroups = new Map<number, PuttingAttempt[]>();
    putts.forEach(p => {
      if (p.holeNumber !== undefined) {
        if (!holeGroups.has(p.holeNumber)) {
          holeGroups.set(p.holeNumber, []);
        }
        holeGroups.get(p.holeNumber)!.push(p);
      }
    });

    // Determine current hole - either the target hole or the first hole
    const firstHole = Math.min(...Array.from(holeGroups.keys()));
    const currentHole = targetHole || firstHole;

    // Find the last completed hole (highest hole number that has been holed out)
    const completedHoles = Array.from(holeGroups.entries())
      .filter(([_, holePutts]) => holePutts.some(p => p.made))
      .map(([holeNum, _]) => holeNum);
    const lastCompletedHole = completedHoles.length > 0 ? Math.max(...completedHoles) : 0;

    // Helper function to convert proximity to position
    const proximityToPosition = (proximity: any, pinPos: { x: number; y: number }, zoom: number) => {
      const metersPerUnit = zoom / 5;
      const dx = proximity.horizontal / metersPerUnit;
      const dy = -proximity.vertical / metersPerUnit;
      return {
        x: pinPos.x + dx,
        y: pinPos.y + dy,
      };
    };

    // Reconstruct holeStates from putts
    const holeStatesRecord: Record<number, any> = {};

    holeGroups.forEach((holePutts, holeNum) => {
      // Sort putts by putt number to ensure correct order
      holePutts.sort((a, b) => (a.puttNumber || 0) - (b.puttNumber || 0));

      // Get pin position from the first putt, or use default if not available
      const firstPutt = holePutts[0];
      const actualPinPosition = firstPutt.pinPosition || { x: 50, y: 50 };

      // Default values for visual state
      const defaultZoom = 2.2;
      const defaultGreenScale = 1;
      const defaultGreenShape = { rx: 55, ry: 63 };
      const defaultViewBoxOffset = { x: 0, y: 0 };

      // Build putt history from the saved putts
      // IMPORTANT: Reconstruct startProximity from previous putt's endProximity
      const puttHistory = holePutts.map((putt, idx) => {
        // Calculate endDistance from endProximity (distance from pin to where ball stopped)
        let endDistance = 0;
        if (putt.proximity) {
          endDistance = Math.sqrt(
            putt.proximity.horizontal * putt.proximity.horizontal +
            putt.proximity.vertical * putt.proximity.vertical
          );
        }

        return {
          puttNum: putt.puttNumber || (idx + 1),
          distance: putt.distance,
          startProximity: idx === 0 ? (putt.startProximity || null) : (holePutts[idx - 1].proximity || null),
          endProximity: putt.proximity || null,
          endDistance: endDistance,
          made: putt.made,
        };
      });

      // Determine ball position from last putt
      const lastPutt = holePutts[holePutts.length - 1];
      let ballPosition = null;

      if (!lastPutt.made && lastPutt.proximity) {
        // Ball is at the end position of the last missed putt
        ballPosition = proximityToPosition(lastPutt.proximity, actualPinPosition, defaultZoom);
      }
      // If last putt was made, ball position is null (holed out)

      // Determine if hole is complete
      const holeComplete = holePutts.some(p => p.made);

      // Calculate current distance (for next putt if hole not complete)
      let currentDistance = 5.5; // default
      if (!holeComplete && lastPutt.proximity) {
        // Calculate distance from proximity
        const h = lastPutt.proximity.horizontal;
        const v = lastPutt.proximity.vertical;
        currentDistance = Math.sqrt(h * h + v * v);
      }

      // Create hole state
      holeStatesRecord[holeNum] = {
        hole: holeNum,
        puttHistory: puttHistory,
        pinPosition: actualPinPosition,
        ballPosition: ballPosition,
        distance: currentDistance,
        distanceInputValue: currentDistance.toFixed(1),
        puttNumber: holeComplete ? holePutts.length : holePutts.length + 1,
        holeComplete: holeComplete,
        greenScale: defaultGreenScale,
        greenShape: defaultGreenShape,
        canvasZoom: defaultZoom,
        viewBoxOffset: defaultViewBoxOffset,
        pendingPutts: [],
      };
    });

    // Create ActiveRoundData structure
    const activeRoundData = {
      id: savedRoundData?.roundId || crypto.randomUUID(),
      courseId: courseName.toLowerCase().replace(/\s+/g, '_'),
      courseName: courseName,
      startTimestamp: startTimestamp,
      currentHole: currentHole,
      lastCompletedHole: lastCompletedHole,
      pendingPutts: putts,
      holeStates: holeStatesRecord,
    };

    // Save to active round storage
    ActiveRoundStorage.saveActiveRound(activeRoundData);

    // Update UI state
    setPendingPuttsCount(putts.length);
    setHolesComplete(completedHoles.length);
    setEditingRoundId(savedRoundData?.roundId || null);
  };

  const handleEditHole = (holeNumber: number) => {
    if (!savedRoundData) return;

    // Store original putts for comparison later
    setOriginalRoundPutts([...savedRoundData.putts]);

    // Set editing round ID if available
    if (savedRoundData.roundId) {
      setEditingRoundId(savedRoundData.roundId);
    }

    // Restore the round data to active storage, targeting the specific hole
    restoreRoundForEditing(
      savedRoundData.putts,
      savedRoundData.courseName,
      savedRoundData.date.toISOString(),
      holeNumber
    );

    // Set up getRoundDataFn immediately for edit mode (prevents race condition)
    const getEditRoundData = () => {
      const activeRound = ActiveRoundStorage.loadActiveRound();
      return {
        putts: activeRound?.pendingPutts || [],
        courseName: activeRound?.courseName || savedRoundData.courseName,
        startTimestamp: activeRound?.startTimestamp || savedRoundData.date.toISOString()
      };
    };
    setGetRoundDataFn(() => getEditRoundData);

    // Close summary and navigate to entry tab
    setShowRoundSummary(false);
    setActiveTab('entry');
  };

  const handleExitEditMode = () => {
    // Check if changes were made
    if (getRoundDataFn) {
      const currentData = getRoundDataFn();
      const currentPutts = currentData.putts;

      // Compare current putts with original
      const hasChanges = originalRoundPutts &&
        JSON.stringify(currentPutts) !== JSON.stringify(originalRoundPutts);

      if (hasChanges) {
        // Show confirmation dialog
        setShowEditExitConfirmation(true);
      } else {
        // No changes, just exit
        exitEditModeWithoutSaving();
      }
    } else {
      exitEditModeWithoutSaving();
    }
  };

  const handleNavigationAttempt = (targetTab: 'home' | 'entry' | 'stats') => {
    console.log('[NAV] Navigation attempt to:', targetTab);
    console.log('[NAV] editingRoundId:', editingRoundId);
    console.log('[NAV] getRoundDataFn:', getRoundDataFn ? 'exists' : 'NULL');

    // If not editing, allow navigation
    if (!editingRoundId) {
      console.log('[NAV] Not editing, navigating directly');
      setActiveTab(targetTab);
      return;
    }

    // We're in edit mode - need to check for changes
    if (!getRoundDataFn) {
      // Shouldn't happen after setting it immediately in handleEditHole, but handle gracefully
      console.warn('[NAV] getRoundDataFn not ready, blocking navigation');
      alert('Please wait for the round to load before navigating.');
      return;
    }

    try {
      console.log('[NAV] About to call getRoundDataFn...');
      const currentData = getRoundDataFn();
      console.log('[NAV] Got current data:', currentData);

      const currentPutts = currentData.putts;
      console.log('[NAV] Current putts count:', currentPutts?.length);
      console.log('[NAV] Original putts count:', originalRoundPutts?.length);

      const hasChanges = originalRoundPutts &&
        JSON.stringify(currentPutts) !== JSON.stringify(originalRoundPutts);
      console.log('[NAV] Has changes?', hasChanges);

      if (hasChanges) {
        console.log('[NAV] Changes detected, showing confirmation dialog');
        // Store where user wanted to go and show confirmation
        setPendingNavigation(targetTab);
        setShowEditExitConfirmation(true);
      } else {
        console.log('[NAV] No changes detected, exiting without confirmation');
        // No changes - exit edit mode WITHOUT showing summary, then navigate
        exitEditModeWithoutSaving(false);
        setActiveTab(targetTab);
      }
    } catch (error) {
      console.error('[NAV] Error checking changes:', error);
      // On error, show confirmation to be safe
      setPendingNavigation(targetTab);
      setShowEditExitConfirmation(true);
    }
  };

  const exitEditModeWithoutSaving = (showSummary: boolean = true) => {
    // Restore original data
    if (savedRoundData && originalRoundPutts && savedRoundData.roundId) {
      setSavedRoundData({
        ...savedRoundData,
        putts: originalRoundPutts
      });
    }

    // Clear active round and editing state
    ActiveRoundStorage.clearActiveRound();
    setEditingRoundId(null);
    setOriginalRoundPutts(null);
    setPendingPuttsCount(0);
    setHolesComplete(0);
    setShowEditExitConfirmation(false);
    setPendingNavigation(null);

    // Only show round summary if requested
    if (showSummary) {
      setShowRoundSummary(true);
    }
  };

  const saveEditedRoundAndExit = async () => {
    console.log('[SAVE] saveEditedRoundAndExit called');
    console.log('[SAVE] getRoundDataFn:', getRoundDataFn ? 'exists' : 'NULL');
    console.log('[SAVE] savedRoundData:', savedRoundData);
    if (!getRoundDataFn || !savedRoundData || !savedRoundData.roundId) {
      console.error('[SAVE] Missing required data, returning');
      return;
    }

    // Get current round data
    const currentData = getRoundDataFn();

    // Update the existing round (keeps same ID, no duplication)
    await RoundHistory.updateRound(savedRoundData.roundId, {
      putts: currentData.putts,
      course: savedRoundData.courseName,
    });

    // Update savedRoundData with new putts
    setSavedRoundData({
      ...savedRoundData,
      putts: currentData.putts
    });

    // Reload recent rounds
    const rounds = await RoundHistory.getRounds();
    setRecentRounds(rounds);

    // Clear active round and editing state
    ActiveRoundStorage.clearActiveRound();
    setEditingRoundId(null);
    setOriginalRoundPutts(null);
    setPendingPuttsCount(0);
    setHolesComplete(0);
    setShowEditExitConfirmation(false);

    // Return to round summary
    setShowRoundSummary(true);
  };

  const handleStartNewRound = (courseName: string) => {
    // Check if there's an active round
    if (ActiveRoundStorage.hasActiveRound()) {
      setPendingCourseSelection(courseName);
      setShowNewRoundWarning(true);
    } else {
      // No active round, proceed
      startFreshRound(courseName);
    }
  };

  const startFreshRound = (courseName: string) => {
    // Find the course ID from the course name
    const allCourses = [...COURSES, ...customCourses];
    const course = allCourses.find(c => c.name === courseName);
    const courseId = course?.id || 'neangar-park';

    setSelectedCourseId(courseId);
    ActiveRoundStorage.clearActiveRound();
    setPendingPuttsCount(0);
    setHolesComplete(0);
    setResetRound(true);
    setActiveTab('entry');
    setShowNewRoundWarning(false);
    setPendingCourseSelection(null);
  };

  // Reset the resetRound flag after it's been processed
  useEffect(() => {
    if (resetRound && activeTab === 'entry') {
      // Give PuttEntry time to process the reset
      const timer = setTimeout(() => {
        setResetRound(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [resetRound, activeTab]);

  const cancelNewRound = () => {
    setShowNewRoundWarning(false);
    setPendingCourseSelection(null);
  };

  const confirmDiscardAndStart = () => {
    if (pendingCourseSelection) {
      startFreshRound(pendingCourseSelection);
    }
  };

  const getTimeAgo = (date: Date) => {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Show new course modal
  if (showNewCourseModal) {
    return (
      <div className="app-container">
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
            padding: '1.5rem',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
              {editingCourseId ? 'Edit Course' : 'Create New Course'}
            </h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Course Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="Enter course name"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: '#2a2a2a',
                  border: '1px solid #3a3a3a',
                  color: '#fff',
                  fontSize: '1rem'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '600' }}>Hole Details (Optional)</h3>
              <div style={{
                maxHeight: '300px',
                overflow: 'auto',
                border: '1px solid #3a3a3a',
                borderRadius: '8px',
                padding: '0.5rem'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 80px 100px',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                  padding: '0.5rem',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  color: '#888'
                }}>
                  <div>Hole</div>
                  <div>Par</div>
                  <div>Distance (m)</div>
                </div>
                {newCourseHoles.map((hole, index) => (
                  <div key={hole.number} style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 80px 100px',
                    gap: '0.5rem',
                    marginBottom: '0.25rem',
                    padding: '0.25rem',
                    alignItems: 'center'
                  }}>
                    <div style={{ fontSize: '0.9rem', color: '#888' }}>{hole.number}</div>
                    <input
                      type="number"
                      value={hole.par}
                      onChange={(e) => handleHoleDataChange(index, 'par', e.target.value)}
                      min="3"
                      max="6"
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        backgroundColor: '#2a2a2a',
                        border: '1px solid #3a3a3a',
                        color: '#fff',
                        fontSize: '0.9rem'
                      }}
                    />
                    <input
                      type="number"
                      value={hole.distance}
                      onChange={(e) => handleHoleDataChange(index, 'distance', e.target.value)}
                      min="0"
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        backgroundColor: '#2a2a2a',
                        border: '1px solid #3a3a3a',
                        color: '#fff',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelNewCourse}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  backgroundColor: '#2a2a2a',
                  border: '1px solid #3a3a3a',
                  color: '#fff',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewCourse}
                disabled={!newCourseName.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  backgroundColor: newCourseName.trim() ? '#2563eb' : '#3a3a3a',
                  border: 'none',
                  color: '#fff',
                  fontSize: '1rem',
                  cursor: newCourseName.trim() ? 'pointer' : 'not-allowed',
                  opacity: newCourseName.trim() ? 1 : 0.5
                }}
              >
                {editingCourseId ? 'Save Changes' : 'Create Course'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show round summary if round was just saved
  console.log('[RENDER] showRoundSummary:', showRoundSummary, 'savedRoundData:', savedRoundData);
  if (showRoundSummary && savedRoundData) {
    console.log('[RENDER] Showing RoundSummary component');
    return (
      <>
        <div className="app-container">
          <RoundSummary
            putts={savedRoundData.putts}
            courseName={savedRoundData.courseName}
            date={savedRoundData.date}
            isHistorical={isViewingHistoricalRound}
            onEditMetadata={handleEditRoundMetadata}
            onEditHole={handleEditHole}
            onDone={() => {
              console.log('[ROUND SUMMARY] Done button clicked');
              setShowRoundSummary(false);
              setSavedRoundData(null);
              setIsViewingHistoricalRound(false);
              setActiveTab('home');
            }}
          />
        </div>

        {/* Edit Exit Confirmation Dialog - must render even in early returns */}
        {showEditExitConfirmation && (
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
          }}>
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-xl)',
              maxWidth: '400px',
              width: '90%',
            }}>
              <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text)' }}>
                Save Changes?
              </h3>
              <p style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
                You have made changes to this round. Would you like to save them?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                <button
                  onClick={async () => {
                    await saveEditedRoundAndExit();
                    if (pendingNavigation && pendingNavigation !== 'entry') {
                      setShowRoundSummary(false);
                      setActiveTab(pendingNavigation);
                      setPendingNavigation(null);
                    }
                  }}
                  className="submit-button"
                  style={{ width: '100%' }}
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    exitEditModeWithoutSaving(false);
                    if (pendingNavigation) {
                      setActiveTab(pendingNavigation);
                      setPendingNavigation(null);
                    } else {
                      setActiveTab('home');
                    }
                  }}
                  className="auth-button logout-button"
                  style={{ width: '100%' }}
                >
                  Discard Changes
                </button>
                <button
                  onClick={() => {
                    setShowEditExitConfirmation(false);
                    setPendingNavigation(null);
                  }}
                  className="auth-button"
                  style={{ width: '100%', background: 'transparent', border: '1px solid var(--color-border)' }}
                >
                  Continue Editing
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Show splash screen when not authenticated or when user navigates back
  if (!isAuthenticated || showSplashScreen) {
    return (
      <div className="container">
        <div className="login-screen">
          <div className="login-content">
            <img
              src="/GreenComplexLogo.svg"
              alt="Green Complex Logo"
              style={{ width: '200px', height: 'auto', marginBottom: '2rem', margin: 'auto'}}
            />
            <h1>Green Complex</h1>
            <p>Track and analyse your putting performance</p>
            {!isAuthenticated ? (
              <LoginButton />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '300px' }}>
                <button
                  onClick={() => setShowSplashScreen(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: '500',
                    backgroundColor: '#1a7a52',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Continue
                </button>
                <button
                  onClick={logout}
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: '500',
                    backgroundColor: 'transparent',
                    color: '#1a7a52',
                    border: '2px solid #1a7a52',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show green view if entry tab is selected (always show when on entry tab)
  if (activeTab === 'entry') {
    return (
      <>
        <div className="app-container">
          <div className="stats-view">
            {/* <div className="stats-header">
              <button className="back-button" onClick={() => setActiveTab('home')}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <h1>Green</h1>
              {editingRoundId ? (
                <button
                  className="back-button"
                  onClick={handleExitEditMode}
                  style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                >
                  Return
                </button>
              ) : (
                <div style={{ width: '40px' }}></div>
              )}
            </div> */}
            <PuttEntry
              onAddPutt={handleAddPutt}
              isOnline={isOnline}
              onRoundStateChange={handleRoundStateChange}
              onRoundComplete={handleRoundComplete}
              resetRound={resetRound}
              onNavigationAttempt={handleNavigationAttempt}
              courseId={selectedCourseId}
              onDiscardRound={() => {
                setPendingPuttsCount(0);
                setHolesComplete(0);
                setActiveTab('home');
              }}
            />
          </div>
        </div>

        {/* Edit Exit Confirmation Dialog - must render even in early returns */}
        {showEditExitConfirmation && (
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
          }}>
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-xl)',
              maxWidth: '400px',
              width: '90%',
            }}>
              <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text)' }}>
                Save Changes?
              </h3>
              <p style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
                You have made changes to this round. Would you like to save them?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                <button
                  onClick={async () => {
                    await saveEditedRoundAndExit();
                    if (pendingNavigation && pendingNavigation !== 'entry') {
                      setShowRoundSummary(false);
                      setActiveTab(pendingNavigation);
                      setPendingNavigation(null);
                    }
                  }}
                  className="submit-button"
                  style={{ width: '100%' }}
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    exitEditModeWithoutSaving(false);
                    if (pendingNavigation) {
                      setActiveTab(pendingNavigation);
                      setPendingNavigation(null);
                    } else {
                      setActiveTab('home');
                    }
                  }}
                  className="auth-button logout-button"
                  style={{ width: '100%' }}
                >
                  Discard Changes
                </button>
                <button
                  onClick={() => {
                    setShowEditExitConfirmation(false);
                    setPendingNavigation(null);
                  }}
                  className="auth-button"
                  style={{ width: '100%', background: 'transparent', border: '1px solid var(--color-border)' }}
                >
                  Continue Editing
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="app-container">
      {activeTab === 'home' ? (
        <div className="home-view">
          {/* Header */}
          <div className="home-header">
            <button className="back-button" onClick={() => setShowSplashScreen(true)} style={{ marginRight: '12px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
              <h1 className="home-app-title">Home</h1>
              <div style={{ width: '40px' }}></div>
          </div>

          <div className="home-content-wrapper">
          {/* Active Round */}
          {pendingPuttsCount > 0 && !editingRoundId && (
            <>
              <div className="home-section-header">
                <h2 className="home-section-title">Active Round</h2>
                <div className="home-active-indicator"></div>
              </div>

              <div className="home-active-round-card" onClick={() => setActiveTab('entry')}>
                <div className="home-round-header">
                  <div className="home-round-info">
                    <h3>{activeRoundInfo?.courseName || 'Neangar Park Golf Club'}</h3>
                    <p>Started {activeRoundInfo ? getTimeAgo(activeRoundInfo.startTime) : '45m ago'}</p>
                  </div>
                  <div className="home-hole-badge">Hole {holesComplete}</div>
                </div>

                <div className="home-stats-grid">
                  <div className="home-stat-box">
                    <div className="home-stat-label">Total Putts</div>
                    <div className="home-stat-value">{pendingPuttsCount}</div>
                  </div>
                  <div className="home-stat-box">
                    <div className="home-stat-label">Avg</div>
                    <div className="home-stat-value">
                      {holesComplete > 0 ? (pendingPuttsCount / holesComplete).toFixed(2) : '-'}
                    </div>
                  </div>
                </div>

                <div className="home-resume-button-row">
                  <button className="home-resume-button">
                    <span>Resume Round</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </button>
                  <button
                    className="home-action-button home-save-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEndRound();
                    }}
                  >
                    <Save size={18} />
                  </button>
                  <button
                    className="home-action-button home-delete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      ActiveRoundStorage.clearActiveRound();
                      setPendingPuttsCount(0);
                      setHolesComplete(0);
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Search */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 className="home-section-title" style={{ marginBottom: '0' }}>New round</h2>
            {(COURSES.length > 0 || customCourses.length > 0) && (
              <button
                onClick={() => setCourseEditMode(!courseEditMode)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  color: courseEditMode ? '#2563eb' : '#888',
                  fontSize: '0.875rem',
                  fontWeight: courseEditMode ? '600' : '400'
                }}
              >
                {courseEditMode ? 'Done' : 'Edit'}
              </button>
            )}
          </div>
          <div className="home-search-container">
            <div className="home-search-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <input
              type="text"
              className="home-search-input"
              placeholder="Find a course to start..."
              disabled
            />
          </div>

          {/* Quick Start */}
          {pendingPuttsCount === 0 && (
            <>
            {COURSES.map((course) => {
              const effectiveCourse = getEffectiveCourse(course.id);
              const hasCustomization = isCustomized(course.id);

              return (
                <div key={course.id} className="home-round-item" style={{ cursor: 'pointer' }}>
                  <div className="home-round-item-left" onClick={() => !courseEditMode && handleStartNewRound(effectiveCourse.name)}>
                    <div className="home-round-item-info">
                      <h4>
                        {effectiveCourse.name}
                        {hasCustomization && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#888', fontWeight: '400' }}>
                            (Modified)
                          </span>
                        )}
                      </h4>
                    </div>
                  </div>
                  <div className="home-round-item-right" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {courseEditMode ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCourse(effectiveCourse);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            color: '#888'
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        {hasCustomization && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCourse(course.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0.25rem',
                              display: 'flex',
                              alignItems: 'center',
                              color: '#888'
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          </button>
                        )}
                      </>
                    ) : (
                      <div onClick={() => handleStartNewRound(effectiveCourse.name)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12"/>
                          <polyline points="12 5 19 12 12 19"/>
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {customCourses
              .filter(course => !COURSES.some(c => c.id === course.id)) // Filter out overrides (already shown above)
              .map((course) => (
              <div key={course.id} className="home-round-item" style={{ cursor: 'pointer' }}>
                <div className="home-round-item-left" onClick={() => !courseEditMode && handleStartNewRound(course.name)}>
                  <div className="home-round-item-info">
                    <h4>{course.name}</h4>
                  </div>
                </div>
                <div className="home-round-item-right" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {courseEditMode ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCourse(course);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          color: '#888'
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCourse(course.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          color: '#888'
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </>
                  ) : (
                    <div onClick={() => handleStartNewRound(course.name)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="home-round-item" onClick={() => setShowNewCourseModal(true)} style={{ cursor: 'pointer' }}>
              <div className="home-round-item-left">
                <div className="home-round-item-info">
                  <h4 style={{ fontWeight: '400', color: '#888' }}>+ New Course</h4>
                </div>
              </div>
            </div>
            </>
          )}

          {/* Recent Activity */}
          <div className="home-recent-section">
            <h2 className="home-section-title">Previous rounds</h2>
            <div className="home-recent-list">
              {recentRounds.length === 0 ? (
                <div className="home-empty-state">No recent rounds to display</div>
              ) : (
                recentRounds.map((round) => {
                  const date = new Date(round.timestamp);
                  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const pph = round.holesPlayed > 0 ? (round.totalPutts / round.holesPlayed).toFixed(2) : '0.00';

                  const isMenuOpen = openMenuRoundId === round.id;

                  return (
                    <div key={round.id} className="home-round-item-wrapper">
                      <div className="home-round-item" onClick={() => !isMenuOpen && handleViewRound(round)}>
                        <div className="home-round-item-left">
                          <div className="home-calendar-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                              <line x1="16" y1="2" x2="16" y2="6"/>
                              <line x1="8" y1="2" x2="8" y2="6"/>
                              <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                          </div>
                          <div className="home-round-item-info">
                            <h4>{round.course || 'Unknown Course'}</h4>
                            <p>{dateStr} • {round.holesPlayed} Hole{round.holesPlayed !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="home-round-item-right">
                          <div className="home-round-total">{round.totalPutts}</div>
                          <div className="home-round-pph">{pph} AVG</div>
                          <button
                            className={`home-round-menu-button ${isMenuOpen ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuRoundId(isMenuOpen ? null : round.id);
                            }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="1"/>
                              <circle cx="12" cy="5" r="1"/>
                              <circle cx="12" cy="19" r="1"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      {isMenuOpen && (
                        <div className="home-round-item-actions">
                          <button
                            className="home-round-action-button home-round-view-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuRoundId(null);
                              handleViewRound(round);
                            }}
                          >
                            <span>View Round</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="5" y1="12" x2="19" y2="12"/>
                              <polyline points="12 5 19 12 12 19"/>
                            </svg>
                          </button>
                          <button
                            className="home-action-button home-delete-button"
                            onClick={(e) => handleDeleteRound(round.id, e)}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          </div>
        </div>
      ) : activeTab === 'stats' ? (
        <div className="stats-view">
          <div className="stats-header">
            <button className="back-button" onClick={() => setActiveTab('home')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <h1>Statistics</h1>
            <div style={{ width: '40px' }}></div>
          </div>
          {isLoading ? (
            <div className="loading">Loading statistics...</div>
          ) : (
            <StatsDisplay putts={putts} unit="metres" />
          )}
        </div>
      ) : (
        <div className="settings-view">
          <div className="stats-header">
            <button className="back-button" onClick={() => setActiveTab('home')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <h1>Settings</h1>
            <div style={{ width: '40px' }}></div>
          </div>

          <div className="settings-content">
            {/* User Profile Card */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem',
              backgroundColor: 'rgba(26, 122, 82, 0.1)',
              borderRadius: '12px',
              border: '1px solid rgba(26, 122, 82, 0.2)'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#2a2a2a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: '#fff'
              }}>
                {username ? username.substring(0, 2).toUpperCase() : 'U'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>
                  {username || 'User'}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#888' }}>
                  {username ? `${username}@example.com` : 'user@example.com'}
                </div>
              </div>
            </div>

            {/* Preferences Section */}
            <div>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#888',
                letterSpacing: '0.05em',
                marginBottom: '0.75rem',
                paddingLeft: '0.5rem'
              }}>
                PREFERENCES
              </div>

              <div style={{
                backgroundColor: '#1a1a1a',
                borderRadius: '12px',
                border: '1px solid #2a2a2a',
                overflow: 'hidden'
              }}>
                {/* Distance Units */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderBottom: '1px solid #2a2a2a'
                }}>
                  <span style={{ fontSize: '1rem', color: '#fff' }}>Distance Units</span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#888'
                  }}>
                    <span>Meters</span>
                    <div style={{
                      width: '44px',
                      height: '26px',
                      backgroundColor: '#2a2a2a',
                      borderRadius: '13px',
                      position: 'relative',
                      cursor: 'not-allowed',
                      opacity: 0.5
                    }}>
                      <div style={{
                        width: '22px',
                        height: '22px',
                        backgroundColor: '#666',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: '2px',
                        transition: 'all 0.2s'
                      }} />
                    </div>
                  </div>
                </div>

                {/* Appearance */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem'
                }}>
                  <span style={{ fontSize: '1rem', color: '#fff' }}>Appearance</span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#888'
                  }}>
                    <span>Dark</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Data Section */}
            <div>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#888',
                letterSpacing: '0.05em',
                marginBottom: '0.75rem',
                paddingLeft: '0.5rem'
              }}>
                DATA
              </div>

              <div style={{
                backgroundColor: '#1a1a1a',
                borderRadius: '12px',
                border: '1px solid #2a2a2a',
                overflow: 'hidden'
              }}>
                <button
                  onClick={() => {
                    // TODO: Implement export functionality
                    alert('Export functionality coming soon!');
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span>Export as CSV</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Data & Sync Section */}
            <div>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#888',
                letterSpacing: '0.05em',
                marginBottom: '0.75rem',
                paddingLeft: '0.5rem'
              }}>
                BACKUP & SYNC
              </div>

              <div style={{
                backgroundColor: '#1a1a1a',
                borderRadius: '12px',
                border: '1px solid #2a2a2a',
                overflow: 'hidden'
              }}>
                {/* Recovery Code */}
                <div style={{
                  padding: '1rem',
                  borderBottom: '1px solid #2a2a2a'
                }}>
                  <div style={{
                    fontSize: '1rem',
                    color: '#fff',
                    marginBottom: '0.5rem',
                    fontWeight: '500'
                  }}>
                    Recovery Code
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#888',
                    marginBottom: '0.75rem'
                  }}>
                    Save this code to access your data on other devices
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center',
                  }}>
                    <input
                      type={showRecoveryCode ? 'text' : 'password'}
                      value={recoveryCode}
                      readOnly
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        fontSize: '0.8rem',
                        fontFamily: 'monospace',
                        backgroundColor: '#0a0a0a',
                        color: '#fff',
                        border: '1px solid #2a2a2a',
                        borderRadius: '8px',
                      }}
                    />
                    <button
                      onClick={() => setShowRecoveryCode(!showRecoveryCode)}
                      style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: '#2a2a2a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {showRecoveryCode ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(recoveryCode);
                        alert('Recovery code copied to clipboard!');
                      }}
                      style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: '#1a7a52',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  <button
                    onClick={() => setShowImportModal(true)}
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'transparent',
                      color: '#ef4444',
                      border: '1px solid #ef4444',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      width: '100%',
                      fontSize: '0.875rem',
                      fontWeight: '500'
                    }}
                  >
                    Import Recovery Code
                  </button>
                </div>

                {/* Sync Status */}
                {syncStatus && (
                  <div style={{
                    padding: '1rem'
                  }}>
                    <div style={{
                      fontSize: '1rem',
                      color: '#fff',
                      marginBottom: '0.5rem',
                      fontWeight: '500'
                    }}>
                      Sync Status
                    </div>
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      marginBottom: '0.75rem'
                    }}>
                      <div style={{ color: '#888', marginBottom: '0.5rem' }}>
                        Last synced: {syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : 'Never'}
                      </div>
                      <div style={{ color: '#888', marginBottom: '0.5rem' }}>
                        Pending changes: {syncStatus.pendingChanges}
                      </div>
                      <div style={{ color: '#888' }}>
                        Status: {syncStatus.isSyncing ? 'Syncing...' : 'Idle'}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await SyncService.sync();
                        const status = await SyncService.getSyncStatus();
                        setSyncStatus(status);

                        // Reload courses after sync
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
                          console.error('[Sync] Error reloading courses:', error);
                        }

                        alert('Sync complete!');
                      }}
                      disabled={syncStatus.isSyncing}
                      style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: syncStatus.isSyncing ? '#2a2a2a' : '#1a7a52',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: syncStatus.isSyncing ? 'not-allowed' : 'pointer',
                        width: '100%',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        opacity: syncStatus.isSyncing ? 0.5 : 1
                      }}
                    >
                      {syncStatus.isSyncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={() => {
                // Reset initialization flag before logging out
                hasInitializedRef.current = false;
                // Navigate to home tab
                setActiveTab('home');
                // Clear app state
                setPutts([]);
                setRecentRounds([]);
                setPendingPuttsCount(0);
                setHolesComplete(0);
                setActiveRoundInfo(null);
                // Finally logout (this will trigger re-render with splash screen)
                logout();
              }}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: 'transparent',
                border: '2px solid #ef4444',
                borderRadius: '12px',
                color: '#ef4444',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Sign Out
            </button>

            {/* Footer */}
            <div style={{
              textAlign: 'center',
              paddingTop: '1rem',
              fontSize: '0.75rem',
              color: '#666'
            }}>
              <div style={{ marginBottom: '0.5rem' }}>Green Complex v2.4.0</div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <span>Privacy</span>
                <span>•</span>
                <span>Terms</span>
                <span>•</span>
                <span>Help</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <button className={activeTab === 'home' ? 'nav-item active' : 'nav-item'} onClick={() => handleNavigationAttempt('home')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Home</span>
        </button>
        <button className={activeTab === 'stats' ? 'nav-item active' : 'nav-item'} onClick={() => handleNavigationAttempt('stats')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 21v-6"/>
            <path d="M12 21V3"/>
            <path d="M19 21V9"/>
          </svg>
          <span>Stats</span>
        </button>
        <button className={activeTab === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab('settings')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 17H5"/>
            <path d="M19 7h-9"/>
            <circle cx="17" cy="17" r="3"/>
            <circle cx="7" cy="7" r="3"/>
          </svg>
          <span>Settings</span>
        </button>
      </nav>

      {/* Warning Dialog */}
      {showNewRoundWarning && (
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
        }}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-xl)',
            maxWidth: '400px',
            width: '90%',
          }}>
            <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text)' }}>
              Active Round in Progress
            </h3>
            <p style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
              You have an active round with {pendingPuttsCount} putts. Starting a new round will discard this data. Do you want to continue?
            </p>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button
                onClick={cancelNewRound}
                className="auth-button logout-button"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDiscardAndStart}
                className="submit-button"
                style={{ flex: 1, background: 'var(--color-danger)' }}
              >
                Discard & Start New
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Exit Confirmation Dialog */}
      {showEditExitConfirmation && (
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
        }}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-xl)',
            maxWidth: '400px',
            width: '90%',
          }}>
            <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text)' }}>
              Save Changes?
            </h3>
            <p style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
              You have made changes to this round. Would you like to save them?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <button
                onClick={async () => {
                  await saveEditedRoundAndExit();
                  // After saving, navigate if user wanted to go elsewhere
                  if (pendingNavigation && pendingNavigation !== 'entry') {
                    setShowRoundSummary(false);
                    setActiveTab(pendingNavigation);
                    setPendingNavigation(null);
                  }
                }}
                className="submit-button"
                style={{ width: '100%' }}
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  exitEditModeWithoutSaving(false);  // Don't show summary
                  if (pendingNavigation) {
                    setActiveTab(pendingNavigation);
                    setPendingNavigation(null);
                  } else {
                    setActiveTab('home');
                  }
                }}
                className="auth-button logout-button"
                style={{ width: '100%' }}
              >
                Discard Changes
              </button>
              <button
                onClick={() => {
                  setShowEditExitConfirmation(false);
                  setPendingNavigation(null);
                }}
                className="auth-button"
                style={{ width: '100%', background: 'transparent', border: '1px solid var(--color-border)' }}
              >
                Continue Editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Recovery Code Modal */}
      {showImportModal && (
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
        }}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-xl)',
            maxWidth: '500px',
            width: '90%',
          }}>
            <h3 style={{
              marginBottom: 'var(--spacing-md)',
              color: '#ef4444',
              fontSize: '1.25rem',
              fontWeight: '600'
            }}>
              Warning: Import Recovery Code
            </h3>
            <p style={{
              marginBottom: 'var(--spacing-lg)',
              color: 'var(--color-text-secondary)',
              lineHeight: '1.5'
            }}>
              Importing a recovery code will <strong style={{ color: '#ef4444' }}>REPLACE all local data</strong> with data from the cloud for that user ID.
              This action cannot be undone. Make sure you have the correct recovery code.
            </p>
            <input
              type="text"
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              placeholder="Paste recovery code here"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                backgroundColor: '#0a0a0a',
                color: '#fff',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                marginBottom: 'var(--spacing-lg)',
              }}
            />
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportCode('');
                }}
                className="auth-button logout-button"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!importCode.trim()) {
                    alert('Please enter a recovery code');
                    return;
                  }

                  // Clear local database
                  await RoundHistory.clearAll();

                  // Import recovery code
                  UserIdentity.importRecoveryCode(importCode);

                  // Force sync down from cloud
                  await SyncService.syncDown();

                  // Reload app
                  window.location.reload();
                }}
                className="submit-button"
                style={{
                  flex: 1,
                  background: '#ef4444',
                  fontWeight: '600'
                }}
              >
                Import & Replace Local Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
