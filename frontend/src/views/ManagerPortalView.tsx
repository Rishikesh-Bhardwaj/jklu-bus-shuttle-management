import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  Bus,
  MapPin,
  Calendar,
  ClipboardList,
  MessageSquare,
  CheckCircle,
  RotateCcw,
  Plus,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const ManagerPortalView: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'verifications' | 'fleet' | 'routes' | 'trips' | 'checkins' | 'feedback'>('verifications');

  // Global feedback / notification banner
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Tab 1: Verifications State
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState<boolean>(false);
  const [reviewNotesModalUser, setReviewNotesModalUser] = useState<any | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'VERIFIED' | 'REJECTED'>('VERIFIED');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [processingReview, setProcessingReview] = useState<boolean>(false);
  const [auditHistoryModalUser, setAuditHistoryModalUser] = useState<any | null>(null);
  const [auditRecords, setAuditRecords] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);

  // Tab 2: Fleet State
  const [buses, setBuses] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [newBusNo, setNewBusNo] = useState<string>('');
  const [newBusSeats, setNewBusSeats] = useState<number>(32);
  const [newDriverName, setNewDriverName] = useState<string>('');
  const [newDriverLicense, setNewDriverLicense] = useState<string>('');
  const [newDriverPhone, setNewDriverPhone] = useState<string>('');

  // Tab 3: Corridors & Routes State
  const [corridors, setCorridors] = useState<any[]>([]);
  const [stops, setStops] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [newCorridorName, setNewCorridorName] = useState<string>('');
  const [newStopName, setNewStopName] = useState<string>('');
  const [newRouteCorridorId, setNewRouteCorridorId] = useState<number | ''>('');
  const [newRouteName, setNewRouteName] = useState<string>('');
  const [newRouteOrigin, setNewRouteOrigin] = useState<string>('');
  const [newRouteDestination, setNewRouteDestination] = useState<string>('');
  const [newRouteDirection, setNewRouteDirection] = useState<'OUTBOUND' | 'RETURN'>('OUTBOUND');
  const [newRouteSelectedStops, setNewRouteSelectedStops] = useState<number[]>([]);

  // Tab 4: Trip Scheduling State
  const [trips, setTrips] = useState<any[]>([]);
  const [newTripRouteId, setNewTripRouteId] = useState<number | ''>('');
  const [newTripBusId, setNewTripBusId] = useState<number | ''>('');
  const [newTripDriverId, setNewTripDriverId] = useState<number | ''>('');
  const [newTripDate, setNewTripDate] = useState<string>('');
  const [newTripTime, setNewTripTime] = useState<string>('07:30');
  const [newTripCategory, setNewTripCategory] = useState<'STANDARD' | 'EXTRA'>('STANDARD');
  const [newTripStatus, setNewTripStatus] = useState<'PUBLISHED' | 'SCHEDULED'>('PUBLISHED');

  // Tab 5: Manifest & Check-In State
  const [selectedManifestTripId, setSelectedManifestTripId] = useState<number | ''>('');
  const [manifestTripSearch, setManifestTripSearch] = useState<string>('');
  const [manifestRows, setManifestRows] = useState<any[]>([]);
  const [manifestSummary, setManifestSummary] = useState<any | null>(null);
  const [loadingManifest, setLoadingManifest] = useState<boolean>(false);
  const [busQrToken, setBusQrToken] = useState<string | null>(null);
  const [generatingBusQr, setGeneratingBusQr] = useState<boolean>(false);

  // Tab 6: Feedback Moderation State
  const [adminFeedback, setAdminFeedback] = useState<any[]>([]);

  // Delete Confirmation Modal State
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
    itemType: 'bus' | 'driver' | 'corridor' | 'stop' | 'route' | 'trip';
    itemId: number;
    itemName: string;
    isDeactivation?: boolean;
  } | null>(null);
  const [processingDelete, setProcessingDelete] = useState<boolean>(false);

  // Bus Reactivation State
  const [retiredBusPrompt, setRetiredBusPrompt] = useState<{
    busId: number;
    busNo: string;
    totalSeats: number;
  } | null>(null);
  const [reactivateConfirmModal, setReactivateConfirmModal] = useState<{
    isOpen: boolean;
    busId: number;
    busNo: string;
  } | null>(null);
  const [processingReactivate, setProcessingReactivate] = useState<boolean>(false);

  // -------------------------------------------------------------
  // Data Loaders
  // -------------------------------------------------------------

  const loadPendingVerifications = async () => {
    try {
      setLoadingPending(true);
      const data = await apiRequest('/verification/pending');
      setPendingUsers(data.pendingUsers || []);
    } catch (err: any) {
      setBannerError(err.message || 'Failed to load pending verifications.');
    } finally {
      setLoadingPending(false);
    }
  };

  const loadFleet = async () => {
    try {
      const [busData, driverData] = await Promise.all([
        apiRequest('/fleet/buses'),
        apiRequest('/fleet/drivers'),
      ]);
      setBuses(busData.buses || []);
      setDrivers(driverData.drivers || []);
    } catch (err: any) {
      setBannerError(err.message || 'Failed to load fleet.');
    }
  };

  const loadRoutesAndStops = async () => {
    try {
      const [corridorData, stopData, routeData] = await Promise.all([
        apiRequest('/routes/corridors'),
        apiRequest('/routes/stops'),
        apiRequest('/routes'),
      ]);
      setCorridors(corridorData.corridors || []);
      setStops(stopData.stops || []);
      setRoutes(routeData.routes || []);
    } catch (err: any) {
      setBannerError(err.message || 'Failed to load routes.');
    }
  };

  const loadTrips = async () => {
    try {
      const data = await apiRequest('/trips');
      setTrips(data.trips || []);
    } catch (err: any) {
      setBannerError(err.message || 'Failed to load trips.');
    }
  };

  const loadManifest = async (tripId: number) => {
    try {
      setLoadingManifest(true);
      const data = await apiRequest(`/check-ins/manifest/${tripId}`);
      setManifestRows(data.manifest || []);
      setManifestSummary(data.summary || null);
    } catch (err: any) {
      setBannerError(err.message || 'Failed to load manifest.');
    } finally {
      setLoadingManifest(false);
    }
  };

  const loadAdminFeedback = async () => {
    try {
      const data = await apiRequest('/feedback/admin/all');
      setAdminFeedback(data.allFeedback || []);
    } catch (err: any) {
      setBannerError(err.message || 'Failed to load feedback for admin.');
    }
  };

  // Initial tab loading trigger
  useEffect(() => {
    if (activeTab === 'verifications') loadPendingVerifications();
    if (activeTab === 'fleet') loadFleet();
    if (activeTab === 'routes') loadRoutesAndStops();
    if (activeTab === 'trips') {
      loadTrips();
      loadFleet();
      loadRoutesAndStops();
    }
    if (activeTab === 'checkins') {
      loadTrips();
    }
    if (activeTab === 'feedback') loadAdminFeedback();
  }, [activeTab]);

  // -------------------------------------------------------------
  // Verification Handlers
  // -------------------------------------------------------------
  const handleReviewUser = async () => {
    if (!reviewNotesModalUser) return;
    try {
      setProcessingReview(true);
      setBannerError(null);
      await apiRequest('/verification/review', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: reviewNotesModalUser.user_id,
          decision: reviewDecision,
          notes: reviewNotes,
        }),
      });
      setBannerSuccess(`User affiliation successfully updated to ${reviewDecision}.`);
      setReviewNotesModalUser(null);
      setReviewNotes('');
      loadPendingVerifications();
    } catch (err: any) {
      setBannerError(err.message || 'Failed to review user.');
    } finally {
      setProcessingReview(false);
    }
  };

  const handleOpenAuditModal = async (targetUser: any) => {
    try {
      setAuditHistoryModalUser(targetUser);
      setLoadingAudit(true);
      const data = await apiRequest(`/verification/audit/${targetUser.user_id}`);
      setAuditRecords(data.auditHistory || []);
    } catch (err: any) {
      setBannerError(err.message || 'Failed to load audit history.');
    } finally {
      setLoadingAudit(false);
    }
  };

  // -------------------------------------------------------------
  // Fleet Handlers
  // -------------------------------------------------------------
  const handleCreateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    setRetiredBusPrompt(null);
    setBannerError(null);
    setBannerSuccess(null);
    try {
      await apiRequest('/fleet/buses', {
        method: 'POST',
        body: JSON.stringify({ busNo: newBusNo, totalSeats: Number(newBusSeats) }),
      });
      setBannerSuccess(`Bus ${newBusNo} registered with ${newBusSeats} physical seats.`);
      setNewBusNo('');
      loadFleet();
    } catch (err: any) {
      if (err.data?.canReactivate && err.data?.bus) {
        setRetiredBusPrompt({
          busId: err.data.bus.bus_id,
          busNo: err.data.bus.bus_no,
          totalSeats: err.data.bus.total_no_of_seats,
        });
        setBannerError(err.message || `Bus "${err.data.bus.bus_no}" already exists as RETIRED.`);
      } else {
        setBannerError(err.message || 'Failed to create bus.');
      }
    }
  };

  const handleConfirmReactivate = async () => {
    if (!reactivateConfirmModal) return;
    try {
      setProcessingReactivate(true);
      setBannerError(null);
      const res = await apiRequest(`/fleet/buses/${reactivateConfirmModal.busId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'ACTIVE' }),
      });
      setBannerSuccess(res.message || `Bus "${reactivateConfirmModal.busNo}" successfully reactivated.`);
      setRetiredBusPrompt(null);
      setReactivateConfirmModal(null);
      loadFleet();
    } catch (err: any) {
      setBannerError(err.message || `Failed to reactivate bus "${reactivateConfirmModal.busNo}".`);
    } finally {
      setProcessingReactivate(false);
    }
  };

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/fleet/drivers', {
        method: 'POST',
        body: JSON.stringify({
          driverName: newDriverName,
          licenceNumber: newDriverLicense,
          phoneNumber: newDriverPhone,
        }),
      });
      setBannerSuccess(`Driver ${newDriverName} registered.`);
      setNewDriverName('');
      setNewDriverLicense('');
      setNewDriverPhone('');
      loadFleet();
    } catch (err: any) {
      setBannerError(err.message || 'Failed to register driver.');
    }
  };

  // -------------------------------------------------------------
  // Route Handlers
  // -------------------------------------------------------------
  const handleCreateCorridor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/routes/corridors', {
        method: 'POST',
        body: JSON.stringify({ corridorName: newCorridorName }),
      });
      setBannerSuccess(`Corridor "${newCorridorName}" registered.`);
      setNewCorridorName('');
      loadRoutesAndStops();
    } catch (err: any) {
      setBannerError(err.message || 'Failed to create corridor.');
    }
  };

  const handleCreateStop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/routes/stops', {
        method: 'POST',
        body: JSON.stringify({ stopName: newStopName }),
      });
      setBannerSuccess(`Stop "${newStopName}" registered.`);
      setNewStopName('');
      loadRoutesAndStops();
    } catch (err: any) {
      setBannerError(err.message || 'Failed to create stop.');
    }
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        corridorId: newRouteCorridorId,
        routeName: newRouteName,
        origin: newRouteOrigin,
        destination: newRouteDestination,
        direction: newRouteDirection,
      };

      if (newRouteSelectedStops.length > 0) {
        payload.stops = newRouteSelectedStops.map((stopId, idx) => ({
          stopId,
          stopOrder: idx + 1,
          estimatedOffsetMinutes: idx * 10,
        }));
      }

      await apiRequest('/routes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setBannerSuccess(`Route "${newRouteName}" registered.`);
      setNewRouteName('');
      setNewRouteOrigin('');
      setNewRouteDestination('');
      setNewRouteSelectedStops([]);
      loadRoutesAndStops();
    } catch (err: any) {
      setBannerError(err.message || 'Failed to create route.');
    }
  };

  // -------------------------------------------------------------
  // Trip Handlers
  // -------------------------------------------------------------
  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    const route = routes.find((r) => r.route_id === Number(newTripRouteId));
    if (!route) {
      setBannerError('Please select a valid route.');
      return;
    }

    try {
      await apiRequest('/trips', {
        method: 'POST',
        body: JSON.stringify({
          routeId: route.route_id,
          direction: route.direction,
          busId: newTripBusId,
          driverId: newTripDriverId || undefined,
          tripDate: newTripDate,
          departureTime: newTripTime,
          tripCategory: newTripCategory,
          tripStatus: newTripStatus,
        }),
      });
      setBannerSuccess('Trip scheduled successfully.');
      loadTrips();
    } catch (err: any) {
      setBannerError(err.message || 'Failed to schedule trip.');
    }
  };

  const handleUpdateTripStatus = async (tripId: number, status: string) => {
    try {
      await apiRequest(`/trips/${tripId}`, {
        method: 'PUT',
        body: JSON.stringify({ tripStatus: status }),
      });
      setBannerSuccess(`Trip #${tripId} status updated to ${status}.`);
      loadTrips();
    } catch (err: any) {
      setBannerError(err.message || 'Failed to update trip status.');
    }
  };

  // -------------------------------------------------------------
  // Manifest / Check-In Handlers
  // -------------------------------------------------------------
  const handleGenerateBusQr = async () => {
    if (!selectedManifestTripId) return;
    try {
      setGeneratingBusQr(true);
      setBusQrToken(null);
      const data = await apiRequest(`/check-ins/trips/${selectedManifestTripId}/qr`, { method: 'POST' });
      setBusQrToken(data.token);
      setBannerSuccess('Bus check-in QR generated. It expires in 1 hour; refresh it when needed.');
    } catch (err: any) {
      setBannerError(err.message || 'Failed to generate the bus check-in QR.');
    } finally {
      setGeneratingBusQr(false);
    }
  };

  const handleBoardPassenger = async (bookingId: number) => {
    try {
      await apiRequest(`/check-ins/${bookingId}/board`, { method: 'POST' });
      setBannerSuccess(`Booking #${bookingId} marked as BOARDED.`);
      if (selectedManifestTripId) loadManifest(Number(selectedManifestTripId));
    } catch (err: any) {
      setBannerError(err.message || 'Failed to mark passenger as boarded.');
    }
  };

  const handleNoShowPassenger = async (bookingId: number) => {
    try {
      await apiRequest(`/check-ins/${bookingId}/no-show`, { method: 'POST' });
      setBannerSuccess(`Booking #${bookingId} marked as NO-SHOW.`);
      if (selectedManifestTripId) loadManifest(Number(selectedManifestTripId));
    } catch (err: any) {
      setBannerError(err.message || 'Failed to mark passenger as no-show.');
    }
  };

  // -------------------------------------------------------------
  // Feedback Moderation Handler
  // -------------------------------------------------------------
  const handleToggleFeedbackStatus = async (feedbackId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'PUBLISHED' ? 'HIDDEN' : 'PUBLISHED';
    try {
      await apiRequest(`/feedback/admin/${feedbackId}/moderate`, {
        method: 'PATCH',
        body: JSON.stringify({ moderationStatus: nextStatus }),
      });
      setBannerSuccess(`Feedback #${feedbackId} moderation status updated to ${nextStatus}. Review text, rating, and author details preserved.`);
      loadAdminFeedback();
    } catch (err: any) {
      setBannerError(err.message || 'Failed to moderate feedback.');
    }
  };

  // -------------------------------------------------------------
  // Delete / Deactivate Handlers
  // -------------------------------------------------------------
  const handleResourceStatusToggle = async (type: 'bus' | 'driver' | 'route' | 'stop' | 'corridor', id: number, currentStatus: string, label: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? (type === 'bus' ? 'RETIRED' : 'INACTIVE') : 'ACTIVE';
    try {
      const result = await apiRequest(`/resources/${type}/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
      setBannerSuccess(result.message || `${label} status changed to ${nextStatus}.`);
      if (type === 'bus' || type === 'driver') loadFleet(); else loadRoutesAndStops();
    } catch (err: any) {
      const trips = err.dependencies?.trips;
      const details = Array.isArray(trips) ? trips.map((trip: any) => `#${trip.trip_id} (${trip.trip_status})`).join(', ') : '';
      setBannerError((err.message || `Could not update ${label} status.`) + (details ? ` Dependent trips: ${details}.` : ''));
    }
  };
  const handleConfirmDelete = async () => {
    if (!deleteConfirmModal) return;
    const { itemType, itemId, itemName } = deleteConfirmModal;
    try {
      setProcessingDelete(true);
      setBannerError(null);
      let res: any;
      if (itemType === 'bus') {
        res = await apiRequest(`/fleet/buses/${itemId}`, { method: 'DELETE' });
        setBannerSuccess(res.message || `Bus ${itemName} permanently deleted.`);
        loadFleet();
      } else if (itemType === 'driver') {
        res = await apiRequest(`/fleet/drivers/${itemId}`, { method: 'DELETE' });
        setBannerSuccess(res.message || `Driver ${itemName} permanently deleted.`);
        loadFleet();
      } else if (itemType === 'corridor') {
        res = await apiRequest(`/routes/corridors/${itemId}`, { method: 'DELETE' });
        setBannerSuccess(res.message || `Corridor "${itemName}" successfully deleted.`);
        loadRoutesAndStops();
      } else if (itemType === 'stop') {
        res = await apiRequest(`/routes/stops/${itemId}`, { method: 'DELETE' });
        setBannerSuccess(res.message || `Stop "${itemName}" successfully deleted.`);
        loadRoutesAndStops();
      } else if (itemType === 'route') {
        res = await apiRequest(`/routes/${itemId}`, { method: 'DELETE' });
        setBannerSuccess(res.message || `Route "${itemName}" successfully deleted.`);
        loadRoutesAndStops();
      } else if (itemType === 'trip') {
        res = await apiRequest(`/trips/${itemId}`, { method: 'DELETE' });
        setBannerSuccess(res.message || `Trip #${itemId} cancelled.`);
        loadTrips();
      }
      setDeleteConfirmModal(null);
    } catch (err: any) {
      setBannerError(err.message || `Failed to delete ${itemName}.`);
    } finally {
      setProcessingDelete(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-900 via-neutral-900 to-neutral-900 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Transport Manager Administration Portal</span>
          </div>
          <h2 className="text-2xl font-bold">JKLU Shuttle Control Center</h2>
          <p className="text-xs text-neutral-300">
            Manager: {user?.fullName} ({user?.email})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-white/10 text-xs font-mono">
            Direct MySQL 8.0 DML
          </span>
        </div>
      </div>

      {/* Notifications */}
      {bannerSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{bannerSuccess}</span>
          </div>
          <button onClick={() => setBannerSuccess(null)} className="text-emerald-600 font-bold">×</button>
        </div>
      )}

      {bannerError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{bannerError}</span>
          </div>
          <button onClick={() => setBannerError(null)} className="text-rose-600 font-bold">×</button>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap gap-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('verifications')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'verifications'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400 font-bold'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Affiliation Verifications ({pendingUsers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('fleet')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'fleet'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400 font-bold'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <Bus className="w-4 h-4" />
          <span>Fleet & Drivers ({buses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('routes')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'routes'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400 font-bold'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Corridors & Routes</span>
        </button>

        <button
          onClick={() => setActiveTab('trips')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'trips'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400 font-bold'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Trip Scheduling</span>
        </button>

        <button
          onClick={() => setActiveTab('checkins')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'checkins'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400 font-bold'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Passenger Manifest & Boarding</span>
        </button>

        <button
          onClick={() => setActiveTab('feedback')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'feedback'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400 font-bold'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Feedback Moderation</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: AFFILIATION VERIFICATIONS */}
      {/* ============================================================== */}
      {activeTab === 'verifications' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between text-xs">
            <div>
              <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                Pending Student & Faculty Approvals
              </h3>
              <p className="text-neutral-500">
                Ascending deadlock-free database row-locks safeguard all state changes and log immutable audit entries.
              </p>
            </div>
            <button
              onClick={loadPendingVerifications}
              className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {loadingPending ? (
            <div className="py-12 flex justify-center text-xs text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Loading pending users...</span>
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-500 text-xs space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="font-bold text-neutral-800 dark:text-neutral-200">
                All affiliation verifications are up to date.
              </p>
              <p className="text-[11px] text-neutral-400">
                Zero pending student or faculty review requests.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">User ID</th>
                    <th className="p-3">Full Name</th>
                    <th className="p-3">Roll / Faculty ID</th>
                    <th className="p-3">University Email</th>
                    <th className="p-3">Role / Category</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Submitted</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {pendingUsers.map((u) => (
                    <tr key={u.user_id} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/40">
                      <td className="p-3 font-mono font-bold text-neutral-700 dark:text-neutral-300">
                        #{u.user_id}
                      </td>
                      <td className="p-3 font-semibold text-neutral-900 dark:text-neutral-100">
                        {u.full_name}
                      </td>
                      <td className="p-3 font-mono text-neutral-800 dark:text-neutral-200">
                        {u.identification_number ? (
                          <span className="font-semibold px-2 py-0.5 rounded bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200/50 dark:border-primary-800/50">
                            {u.identification_number}
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic">Not provided</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-neutral-600 dark:text-neutral-400">
                        {u.email}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                          {u.role} {u.student_category ? `(${u.student_category})` : ''}
                        </span>
                      </td>
                      <td className="p-3 text-neutral-500">{u.phone_number || '—'}</td>
                      <td className="p-3 text-neutral-400 text-[11px]">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => handleOpenAuditModal(u)}
                          className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-neutral-700 dark:text-neutral-300 text-[11px]"
                        >
                          Audit Log
                        </button>
                        <button
                          onClick={() => {
                            setReviewNotesModalUser(u);
                            setReviewDecision('VERIFIED');
                            setReviewNotes('Affiliation confirmed from university records.');
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] shadow-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setReviewNotesModalUser(u);
                            setReviewDecision('REJECTED');
                            setReviewNotes('Email or registration details could not be verified.');
                          }}
                          className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] shadow-sm"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: FLEET & DRIVERS */}
      {/* ============================================================== */}
      {activeTab === 'fleet' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Buses Column */}
          <div className="space-y-4">
            <div className="p-5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Bus className="w-4 h-4 text-primary-600" />
                <span>Register Bus & Auto-Generate Seats</span>
              </h3>
              <p className="text-xs text-neutral-500">
                Registering a vehicle automatically generates individual physical seat inventory rows in MySQL.
              </p>

              <form onSubmit={handleCreateBus} className="space-y-3 text-xs">
                {retiredBusPrompt && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Bus "{retiredBusPrompt.busNo}" is currently RETIRED</span>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400">
                      This bus already has {retiredBusPrompt.totalSeats} physical seats recorded. Would you like to reactivate it instead?
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setReactivateConfirmModal({
                          isOpen: true,
                          busId: retiredBusPrompt.busId,
                          busNo: retiredBusPrompt.busNo,
                        })}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reactivate Bus Now</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRetiredBusPrompt(null)}
                        className="px-3 py-1.5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <label className="font-semibold block mb-1">Bus Number (e.g. RJ14-PA-1234)</label>
                  <input
                    type="text"
                    required
                    value={newBusNo}
                    onChange={(e) => {
                      setNewBusNo(e.target.value);
                      if (retiredBusPrompt) setRetiredBusPrompt(null);
                    }}
                    placeholder="e.g. JKLU-BUS-01"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Total Physical Seat Capacity</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={80}
                    value={newBusSeats}
                    onChange={(e) => setNewBusSeats(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Bus</span>
                </button>
              </form>
            </div>

            {/* Buses List */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-4 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-500">
                Registered Bus Fleet ({buses.length})
              </h4>
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                {buses.map((bus) => (
                  <div key={bus.bus_id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                        {bus.bus_no}
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        {bus.total_no_of_seats} physical seats generated
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        bus.status === 'ACTIVE'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : bus.status === 'MAINTENANCE'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                      }`}>
                        {bus.status}
                      </span>
                      <button type="button" onClick={() => handleResourceStatusToggle('bus', bus.bus_id, bus.status, `Bus ${bus.bus_no}`)} className="px-2 py-1 rounded text-[10px] bg-neutral-100 dark:bg-neutral-800">{bus.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
                      {bus.status === 'RETIRED' ? (
                        <>
                        <button
                          type="button"
                          onClick={() => setReactivateConfirmModal({
                            isOpen: true,
                            busId: bus.bus_id,
                            busNo: bus.bus_no,
                          })}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors flex items-center gap-1 shadow-sm"
                          title="Reactivate Bus"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reactivate</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmModal({
                            isOpen: true,
                            title: 'Permanently Delete Bus',
                            message: `Are you sure you want to permanently delete bus "${bus.bus_no}" and its seat inventory?`,
                            details: 'Deletion is allowed only when no trips or passenger bookings reference this bus. Otherwise, the request will be blocked and the records will remain unchanged.',
                            itemType: 'bus',
                            itemId: bus.bus_id,
                            itemName: bus.bus_no
                          })}
                          className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Permanently Delete Bus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmModal({
                            isOpen: true,
                            title: 'Permanently Delete Bus',
                            message: `Are you sure you want to permanently delete bus "${bus.bus_no}" and its seat inventory?`,
                            details: 'Deletion is allowed only when no trips or passenger bookings reference this bus. Otherwise, the request will be blocked and the records will remain unchanged.',
                            itemType: 'bus',
                            itemId: bus.bus_id,
                            itemName: bus.bus_no,
                          })}
                          className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Permanently Delete Bus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Drivers Column */}
          <div className="space-y-4">
            <div className="p-5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-600" />
                <span>Register Shuttle Driver</span>
              </h3>

              <form onSubmit={handleCreateDriver} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold block mb-1">Driver Full Name</label>
                  <input
                    type="text"
                    required
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Driving Licence Number</label>
                  <input
                    type="text"
                    required
                    value={newDriverLicense}
                    onChange={(e) => setNewDriverLicense(e.target.value)}
                    placeholder="e.g. RJ1420180012345"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Contact Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={newDriverPhone}
                    onChange={(e) => setNewDriverPhone(e.target.value)}
                    placeholder="+91 9829012345"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Driver</span>
                </button>
              </form>
            </div>

            {/* Drivers List */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-4 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-500">
                Registered Drivers ({drivers.length})
              </h4>
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                {drivers.map((d) => (
                  <div key={d.driver_id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                        {d.driver_name}
                      </span>
                      <span className="text-[11px] text-neutral-500 font-mono">
                        Licence: {d.licence_number} • Phone: {d.phone_number}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        d.status === 'ACTIVE'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                      }`}>
                        {d.status}
                      </span>
                      <button type="button" onClick={() => handleResourceStatusToggle('driver', d.driver_id, d.status, `Driver ${d.driver_name}`)} className="px-2 py-1 rounded text-[10px] bg-neutral-100 dark:bg-neutral-800">{d.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmModal({
                          isOpen: true,
                          title: 'Permanently Delete Driver',
                          message: `Are you sure you want to permanently delete driver "${d.driver_name}"?`,
                          details: 'Deletion is allowed only when no trip references this driver. Otherwise, the request will be blocked and the records will remain unchanged.',
                          itemType: 'driver',
                          itemId: d.driver_id,
                          itemName: d.driver_name
                        })}
                        className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Permanently Delete Driver"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: CORRIDORS & ROUTES */}
      {/* ============================================================== */}
      {activeTab === 'routes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Corridors Form */}
          <div className="p-5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3 text-xs">
            <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
              Add Route Corridor
            </h3>
            <form onSubmit={handleCreateCorridor} className="space-y-3">
              <div>
                <label className="font-semibold block mb-1">Corridor Name</label>
                <input
                  type="text"
                  required
                  value={newCorridorName}
                  onChange={(e) => setNewCorridorName(e.target.value)}
                  placeholder="e.g. Vaishali Nagar Corridor"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold"
              >
                Create Corridor
              </button>
            </form>

            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-1">
              <span className="text-[10px] text-neutral-400 uppercase font-mono block">Existing Corridors ({corridors.length})</span>
              {corridors.map((c) => (
                <div key={c.corridor_id} className="p-2 bg-neutral-50 dark:bg-neutral-950 rounded font-medium flex items-center justify-between">
                  <span>{c.corridor_name}</span>
                  <button type="button" onClick={() => handleResourceStatusToggle('corridor', c.corridor_id, c.status || 'ACTIVE', `Corridor ${c.corridor_name}`)} className="px-2 py-1 rounded text-[10px] bg-neutral-100 dark:bg-neutral-800">{c.status === 'INACTIVE' ? 'Activate' : 'Deactivate'}</button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmModal({
                      isOpen: true,
                      title: 'Delete Corridor',
                      message: `Are you sure you want to delete corridor "${c.corridor_name}"?`,
                      details: 'Corridors assigned to active or existing routes cannot be deleted. All dependent routes must be removed first.',
                      itemType: 'corridor',
                      itemId: c.corridor_id,
                      itemName: c.corridor_name
                    })}
                    className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-colors"
                    title="Delete Corridor"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Stops Form */}
          <div className="p-5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3 text-xs">
            <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
              Add Boarding Stop
            </h3>
            <form onSubmit={handleCreateStop} className="space-y-3">
              <div>
                <label className="font-semibold block mb-1">Stop Name</label>
                <input
                  type="text"
                  required
                  value={newStopName}
                  onChange={(e) => setNewStopName(e.target.value)}
                  placeholder="e.g. Queens Road Circle"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold"
              >
                Create Stop
              </button>
            </form>

            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-1 max-h-56 overflow-y-auto">
              <span className="text-[10px] text-neutral-400 uppercase font-mono block">Existing Stops ({stops.length})</span>
              {stops.map((s) => (
                <div key={s.stop_id} className="p-1.5 bg-neutral-50 dark:bg-neutral-950 rounded text-[11px] flex items-center justify-between">
                  <span>{s.stop_name}</span>
                  <button type="button" onClick={() => handleResourceStatusToggle('stop', s.stop_id, s.status || 'ACTIVE', `Stop ${s.stop_name}`)} className="px-2 py-1 rounded text-[10px] bg-neutral-100 dark:bg-neutral-800">{s.status === 'INACTIVE' ? 'Activate' : 'Deactivate'}</button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmModal({
                      isOpen: true,
                      title: 'Delete Boarding Stop',
                      message: `Are you sure you want to delete stop "${s.stop_name}"?`,
                      details: 'Stops currently assigned to routes or historical bookings cannot be deleted until those references are cleared.',
                      itemType: 'stop',
                      itemId: s.stop_id,
                      itemName: s.stop_name
                    })}
                    className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-colors"
                    title="Delete Stop"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Route Creation Form */}
          <div className="p-5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3 text-xs">
            <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
              Create Directional Route
            </h3>
            <form onSubmit={handleCreateRoute} className="space-y-3">
              <div>
                <label className="font-semibold block mb-1">Assigned Corridor</label>
                <select
                  required
                  value={newRouteCorridorId}
                  onChange={(e) => setNewRouteCorridorId(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="">Select Corridor</option>
                  {corridors.map((c) => (
                    <option key={c.corridor_id} value={c.corridor_id}>
                      {c.corridor_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Route Name</label>
                <input
                  type="text"
                  required
                  value={newRouteName}
                  onChange={(e) => setNewRouteName(e.target.value)}
                  placeholder="e.g. Vaishali Morning Express"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Origin</label>
                  <input
                    type="text"
                    required
                    value={newRouteOrigin}
                    onChange={(e) => setNewRouteOrigin(e.target.value)}
                    placeholder="e.g. JKLU Campus"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Destination</label>
                  <input
                    type="text"
                    required
                    value={newRouteDestination}
                    onChange={(e) => setNewRouteDestination(e.target.value)}
                    placeholder="e.g. Amrapali Circle"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Direction</label>
                <select
                  value={newRouteDirection}
                  onChange={(e) => setNewRouteDirection(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="OUTBOUND">OUTBOUND (JKLU → City)</option>
                  <option value="RETURN">RETURN (City → JKLU)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  Assign Stops to Route <span className="text-[11px] font-normal text-neutral-400">(Optional - Auto-assigns Origin & Destination if omitted)</span>
                </label>
                {stops.length === 0 ? (
                  <p className="text-[11px] text-neutral-400 italic">No intermediate stops created yet. Origin and Destination will be registered automatically.</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1 p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950">
                    {stops.map((s) => {
                      const isChecked = newRouteSelectedStops.includes(s.stop_id);
                      return (
                        <label key={s.stop_id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-900 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewRouteSelectedStops([...newRouteSelectedStops, s.stop_id]);
                              } else {
                                setNewRouteSelectedStops(newRouteSelectedStops.filter((id) => id !== s.stop_id));
                              }
                            }}
                            className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-neutral-800 dark:text-neutral-200">{s.stop_name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold"
              >
                Register Route
              </button>
            </form>
          </div>

          {/* Registered Directional Routes List */}
          <div className="lg:col-span-3 p-5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3 text-xs">
            <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-500">
              Registered Directional Routes ({routes.length})
            </h4>
            {routes.length === 0 ? (
              <p className="text-neutral-400 py-3 text-center">No routes registered yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-2.5">Route ID</th>
                      <th className="p-2.5">Route Name</th>
                      <th className="p-2.5">Corridor</th>
                      <th className="p-2.5">Direction</th>
                      <th className="p-2.5">Origin → Destination</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {routes.map((r) => (
                      <tr key={r.route_id} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/40">
                        <td className="p-2.5 font-mono font-bold">#{r.route_id}</td>
                        <td className="p-2.5 font-semibold text-neutral-900 dark:text-neutral-100">{r.route_name}</td>
                        <td className="p-2.5 text-neutral-600 dark:text-neutral-400">{r.corridor_name || `Corridor #${r.corridor_id}`}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                            r.direction === 'OUTBOUND'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              : 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                          }`}>
                            {r.direction}
                          </span>
                        </td>
                        <td className="p-2.5 text-neutral-600 dark:text-neutral-400 font-mono text-[11px]">
                          {r.origin} → {r.destination}
                        </td>
                        <td className="p-2.5 text-right">
                          <button type="button" onClick={() => handleResourceStatusToggle('route', r.route_id, r.status || 'ACTIVE', `Route ${r.route_name}`)} className="px-2 py-1 mr-2 rounded text-[10px] bg-neutral-100 dark:bg-neutral-800">{r.status === 'INACTIVE' ? 'Activate' : 'Deactivate'}</button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmModal({
                              isOpen: true,
                              title: 'Delete Route',
                              message: `Are you sure you want to delete route "${r.route_name}"?`,
                              details: 'Routes assigned to scheduled trips or paired return routes cannot be deleted until those references are removed.',
                              itemType: 'route',
                              itemId: r.route_id,
                              itemName: r.route_name
                            })}
                            className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-colors"
                            title="Delete Route"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: TRIP SCHEDULING */}
      {/* ============================================================== */}
      {activeTab === 'trips' && (
        <div className="space-y-6">
          {/* Schedule New Trip Form */}
          <div className="p-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-600" />
              <span>Schedule New Shuttle Service</span>
            </h3>

            <form onSubmit={handleCreateTrip} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold block mb-1">Route & Direction</label>
                <select
                  required
                  value={newTripRouteId}
                  onChange={(e) => setNewTripRouteId(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="">Select Route</option>
                  {routes.map((r) => (
                    <option key={r.route_id} value={r.route_id}>
                      {r.route_name} ({r.direction})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Assigned Bus</label>
                <select
                  required
                  value={newTripBusId}
                  onChange={(e) => setNewTripBusId(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="">Select Bus</option>
                  {buses.map((b) => (
                    <option key={b.bus_id} value={b.bus_id}>
                      {b.bus_no} ({b.total_no_of_seats} seats)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Assigned Driver</label>
                <select
                  value={newTripDriverId}
                  onChange={(e) => setNewTripDriverId(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="">Select Driver (Optional)</option>
                  {drivers.map((d) => (
                    <option key={d.driver_id} value={d.driver_id}>
                      {d.driver_name} ({d.phone_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Trip Date</label>
                <input
                  type="date"
                  required
                  value={newTripDate}
                  onChange={(e) => setNewTripDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Departure Time</label>
                <input
                  type="time"
                  required
                  value={newTripTime}
                  onChange={(e) => setNewTripTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Trip Category</label>
                <select
                  value={newTripCategory}
                  onChange={(e) => setNewTripCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="STANDARD">STANDARD (Daily Timetable)</option>
                  <option value="EXTRA">EXTRA (Hackathon, Event, Late-Night)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Status</label>
                <select
                  value={newTripStatus}
                  onChange={(e) => setNewTripStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="PUBLISHED">PUBLISHED (Open for booking)</option>
                  <option value="SCHEDULED">SCHEDULED (Draft)</option>
                </select>
              </div>

              <div className="sm:col-span-2 md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Publish Scheduled Trip</span>
                </button>
              </div>
            </form>
          </div>

          {/* Existing Scheduled Trips Table */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-5 space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-500">
              Active Trips Inventory ({trips.length})
            </h4>
            {trips.length === 0 ? (
              <p className="text-xs text-neutral-400 py-4 text-center">No trips scheduled in database.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-2.5">Trip ID</th>
                      <th className="p-2.5">Route</th>
                      <th className="p-2.5">Date & Time</th>
                      <th className="p-2.5">Bus / Seats</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {trips.map((t) => (
                      <tr key={t.trip_id} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/40">
                        <td className="p-2.5 font-mono font-bold">#{t.trip_id}</td>
                        <td className="p-2.5 font-semibold text-neutral-800 dark:text-neutral-200">
                          {t.route_name} ({t.direction})
                        </td>
                        <td className="p-2.5 font-mono">
                          {new Date(t.trip_date).toLocaleDateString()} @ {t.departure_time}
                        </td>
                        <td className="p-2.5">
                          {t.bus_no} ({t.available_seats_count ?? t.total_no_of_seats} free)
                        </td>
                        <td className="p-2.5 font-mono text-[10px]">{t.trip_category}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                              t.trip_status === 'PUBLISHED'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                : t.trip_status === 'SCHEDULED'
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            {t.trip_status}
                          </span>
                        </td>
                        <td className="p-2.5 text-right space-x-1.5">
                          {t.trip_status === 'SCHEDULED' && (
                            <button
                              onClick={() => handleUpdateTripStatus(t.trip_id, 'PUBLISHED')}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-semibold"
                            >
                              Publish
                            </button>
                          )}
                          {t.trip_status !== 'CANCELLED' && t.trip_status !== 'COMPLETED' && (
                            <button
                              onClick={() => handleUpdateTripStatus(t.trip_id, 'CANCELLED')}
                              className="px-2 py-1 bg-neutral-200 dark:bg-neutral-800 hover:bg-rose-100 hover:text-rose-700 rounded text-[10px]"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmModal({
                              isOpen: true,
                              title: 'Cancel Trip',
                              message: `Are you sure you want to cancel trip #${t.trip_id} (${t.route_name})?`,
                              details: 'All confirmed bookings will be cancelled and seat reservations released. Passenger booking and check-in history will be preserved. The trip will remain in the system with CANCELLED status.',
                              itemType: 'trip',
                              itemId: t.trip_id,
                              itemName: `Trip #${t.trip_id} (${t.route_name})`,
                            })}
                            className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-colors inline-flex items-center"
                            title="Cancel Trip"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: PASSENGER MANIFEST & BOARDING */}
      {/* ============================================================== */}
      {activeTab === 'checkins' && (
        <div className="space-y-4">
          <div className="p-5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div>
              <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                Passenger Manifest & Boarding Check-In
              </h3>
              <p className="text-neutral-500">
                Verify passenger digital passes and mark real-time boarding or no-show status.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full sm:w-auto">
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const searchedId = Number(manifestTripSearch.trim());
                  const matchingTrip = trips.find((trip) => Number(trip.trip_id) === searchedId);
                  if (!manifestTripSearch.trim() || !Number.isInteger(searchedId) || searchedId <= 0) {
                    setBannerError('Enter a valid Trip ID to search.');
                    return;
                  }
                  if (!matchingTrip) {
                    setBannerError(`Trip #${manifestTripSearch.trim()} was not found.`);
                    return;
                  }
                  setBannerError(null);
                  setSelectedManifestTripId(searchedId);
                  setBusQrToken(null);
                  loadManifest(searchedId);
                }}
              >
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={manifestTripSearch}
                  onChange={(e) => setManifestTripSearch(e.target.value)}
                  placeholder="Search by Trip ID"
                  aria-label="Search passenger manifest by Trip ID"
                  className="w-full sm:w-40 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold"
                >
                  Search
                </button>
              </form>
              <select
                value={selectedManifestTripId}
                onChange={(e) => {
                  const tripId = e.target.value ? parseInt(e.target.value, 10) : '';
                  setSelectedManifestTripId(tripId);
                  setManifestTripSearch(tripId ? String(tripId) : '');
                  setBusQrToken(null);
                  if (tripId) loadManifest(tripId);
                  else {
                    setManifestRows([]);
                    setManifestSummary(null);
                  }
                }}
                className="w-full sm:w-auto px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              >
                <option value="">Select Scheduled Trip</option>
                {trips.map((t) => (
                  <option key={t.trip_id} value={t.trip_id}>
                    #{t.trip_id}: {t.route_name} ({new Date(t.trip_date).toLocaleDateString()} @ {t.departure_time})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedManifestTripId && (
            <div className="p-5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1">
                <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">Bus QR Self Check-In</h4>
                <p className="text-xs text-neutral-500 mt-1">Display this QR on the bus. Students scan it from My Passes while signed in; confirmed bookings are checked in automatically. The code expires after 1 hour.</p>
                <button
                  type="button"
                  onClick={handleGenerateBusQr}
                  disabled={generatingBusQr}
                  className="mt-3 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-semibold"
                >
                  {generatingBusQr ? 'Generating…' : busQrToken ? 'Refresh Bus QR' : 'Generate Bus QR'}
                </button>
              </div>
              {busQrToken && (
                <div className="text-center">
                  <img
                    src={`https://quickchart.io/qr?size=220&text=${encodeURIComponent(busQrToken)}`}
                    alt="Temporary bus check-in QR code"
                    className="w-44 h-44 border rounded-lg bg-white p-2"
                  />
                  <p className="text-[10px] text-amber-600 font-semibold mt-1">Valid for 1 hour</p>
                </div>
              )}
            </div>
          )}

          {selectedManifestTripId && manifestSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
                <span className="text-neutral-400 block text-[10px] uppercase">Total Booked</span>
                <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{manifestSummary.totalBooked}</span>
              </div>
              <div className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
                <span className="text-emerald-500 block text-[10px] uppercase">Boarded</span>
                <span className="text-lg font-bold text-emerald-600">{manifestSummary.boarded}</span>
              </div>
              <div className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
                <span className="text-amber-500 block text-[10px] uppercase">Awaiting Check-in</span>
                <span className="text-lg font-bold text-amber-600">{manifestSummary.notCheckedIn}</span>
              </div>
              <div className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
                <span className="text-rose-500 block text-[10px] uppercase">No-Show</span>
                <span className="text-lg font-bold text-rose-600">{manifestSummary.noShow}</span>
              </div>
            </div>
          )}

          {selectedManifestTripId ? (
            loadingManifest ? (
              <div className="py-12 flex justify-center text-xs text-neutral-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>Loading trip manifest...</span>
              </div>
            ) : manifestRows.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-500 text-xs">
                No passengers have booked seats on this shuttle yet.
              </div>
            ) : (
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">Seat</th>
                      <th className="p-3">Passenger</th>
                      <th className="p-3">Role / Contact</th>
                      <th className="p-3">Boarding Stop</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {manifestRows.map((m) => (
                      <tr key={m.booking_id} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/40">
                        <td className="p-3 font-mono font-extrabold text-primary-600 dark:text-primary-400 text-sm">
                          {m.seat_number}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                            {m.passenger_name}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {m.passenger_email}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-[11px] block text-neutral-700 dark:text-neutral-300">
                            {m.passenger_role}
                          </span>
                          <span className="text-[10px] text-neutral-400">{m.passenger_phone || 'No phone'}</span>
                        </td>
                        <td className="p-3 font-medium text-neutral-800 dark:text-neutral-200">
                          {m.boarding_stop_name}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                              m.boarding_status === 'BOARDED'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                : m.boarding_status === 'NO_SHOW'
                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                : m.boarding_status === 'CANCELLED_PRIOR'
                                ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {m.boarding_status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-1.5">
                          {m.boarding_status === 'NOT_CHECKED_IN' && (
                            <>
                              <button
                                onClick={() => handleBoardPassenger(m.booking_id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold"
                              >
                                Board
                              </button>
                              <button
                                onClick={() => handleNoShowPassenger(m.booking_id)}
                                className="px-2.5 py-1 bg-neutral-200 dark:bg-neutral-800 hover:bg-rose-100 text-neutral-700 dark:text-neutral-300 hover:text-rose-700 rounded text-[11px]"
                              >
                                No-Show
                              </button>
                            </>
                          )}
                          {m.boarding_status === 'BOARDED' && (
                            <span className="text-[10px] text-emerald-600 font-mono">Checked In</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-400 text-xs">
              Select a scheduled trip above to view passenger manifest.
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 6: FEEDBACK MODERATION */}
      {/* ============================================================== */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between text-xs">
            <div>
              <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                All Submitted Passenger Reviews
              </h3>
              <p className="text-neutral-500">
                Moderate review visibility to maintain campus community standards.
              </p>
            </div>
            <button
              onClick={loadAdminFeedback}
              className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
            {adminFeedback.map((f) => (
              <div key={f.feedback_id} className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      {f.author_name}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      ({f.author_role} • {f.author_email})
                    </span>
                    <span className="font-mono text-amber-500 font-bold">
                      {f.rating} ★
                    </span>
                  </div>
                  <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed text-xs">
                    {f.review_text}
                  </p>
                  <span className="text-[10px] text-neutral-400">
                    Submitted on {new Date(f.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                      f.moderation_status === 'PUBLISHED'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {f.moderation_status}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleFeedbackStatus(f.feedback_id, f.moderation_status)}
                    className="px-2.5 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5 text-[11px] font-medium"
                    title={f.moderation_status === 'PUBLISHED' ? 'Hide Review from Public Feed' : 'Restore & Publish Review'}
                  >
                    {f.moderation_status === 'PUBLISHED' ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Hide / Moderate</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Publish Review</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Notes Modal */}
      {reviewNotesModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
              Confirm Affiliation {reviewDecision}
            </h3>
            <div className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1 bg-neutral-50 dark:bg-neutral-950 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <p>User: <strong className="text-neutral-900 dark:text-neutral-100">{reviewNotesModalUser.full_name}</strong> ({reviewNotesModalUser.email})</p>
              <p>Role: <span className="font-semibold">{reviewNotesModalUser.role}</span> {reviewNotesModalUser.student_category ? `(${reviewNotesModalUser.student_category})` : ''}</p>
              <p>
                {reviewNotesModalUser.role === 'STUDENT' ? 'Roll Number' : 'Faculty ID'}:{' '}
                <strong className="text-neutral-900 dark:text-neutral-100 font-mono">
                  {reviewNotesModalUser.identification_number || 'Not provided'}
                </strong>
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Administrative Review Notes
              </label>
              <textarea
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Audit notes recorded permanently in user_verification_audit..."
                className="w-full p-2.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setReviewNotesModalUser(null)}
                disabled={processingReview}
                className="px-3.5 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewUser}
                disabled={processingReview}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg text-white shadow-sm flex items-center gap-1.5 ${
                  reviewDecision === 'VERIFIED'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {processingReview && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm {reviewDecision}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Audit Log History Modal */}
      {auditHistoryModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 max-w-xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                  Immutable Verification Audit Trail
                </h3>
                <p className="text-xs text-neutral-500">
                  User #{auditHistoryModalUser.user_id}: {auditHistoryModalUser.full_name} ({auditHistoryModalUser.email})
                </p>
              </div>
              <button
                onClick={() => setAuditHistoryModalUser(null)}
                className="p-1 text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 text-xs">
              {loadingAudit ? (
                <div className="py-12 flex justify-center text-neutral-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  <span>Loading audit log...</span>
                </div>
              ) : auditRecords.length === 0 ? (
                <p className="py-8 text-center text-neutral-400">
                  No verification history recorded yet for this user.
                </p>
              ) : (
                auditRecords.map((rec) => (
                  <div
                    key={rec.audit_id}
                    className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-1 font-mono text-[11px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-800 dark:text-neutral-200">
                        {rec.previous_status} → {rec.new_status}
                      </span>
                      <span className="text-neutral-400 text-[10px]">
                        {new Date(rec.reviewed_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400">
                      Notes: {rec.review_notes || 'No review notes provided'}
                    </p>
                    <span className="text-[10px] text-primary-600 block">
                      Reviewer: {rec.reviewer_name || 'System / Self-Reapply'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* Delete / Deactivate Confirmation Dialog Modal */}
      {deleteConfirmModal && deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                  {deleteConfirmModal.title}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                  {deleteConfirmModal.message}
                </p>
              </div>
            </div>

            {deleteConfirmModal.details && (
              <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500 space-y-1">
                <span className="font-semibold block text-neutral-700 dark:text-neutral-300">Notice:</span>
                <p>{deleteConfirmModal.details}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal(null)}
                disabled={processingDelete}
                className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={processingDelete}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-white bg-rose-600 hover:bg-rose-700 shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {processingDelete ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deleteConfirmModal.itemType === 'trip' ? 'Confirm Trip Cancellation' : 'Confirm Permanent Delete'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate Bus Confirmation Dialog Modal */}
      {reactivateConfirmModal && reactivateConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                  Reactivate Bus
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                  Are you sure you want to reactivate bus "{reactivateConfirmModal.busNo}"?
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500 space-y-1">
              <span className="font-semibold block text-neutral-700 dark:text-neutral-300">Notice:</span>
              <p>Reactivating this bus will restore its status to ACTIVE, making it immediately available for scheduling shuttle trips. Its existing physical seat inventory will be preserved without creating duplicate records.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setReactivateConfirmModal(null)}
                disabled={processingReactivate}
                className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReactivate}
                disabled={processingReactivate}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {processingReactivate ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Reactivating...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Confirm Reactivation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
