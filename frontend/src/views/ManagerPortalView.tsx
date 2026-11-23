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
  Clock,
  Eye,
  EyeOff,
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

  // Tab 4: Trip Scheduling & 6:00 PM Audit State
  const [trips, setTrips] = useState<any[]>([]);
  const [newTripRouteId, setNewTripRouteId] = useState<number | ''>('');
  const [newTripBusId, setNewTripBusId] = useState<number | ''>('');
  const [newTripDriverId, setNewTripDriverId] = useState<number | ''>('');
  const [newTripDate, setNewTripDate] = useState<string>('');
  const [newTripTime, setNewTripTime] = useState<string>('07:30');
  const [newTripCategory, setNewTripCategory] = useState<'STANDARD' | 'EXTRA'>('STANDARD');
  const [newTripStatus, setNewTripStatus] = useState<'PUBLISHED' | 'SCHEDULED'>('PUBLISHED');
  const [auditReport, setAuditReport] = useState<any | null>(null);
  const [runningAudit, setRunningAudit] = useState<boolean>(false);

  // Tab 5: Manifest & Check-In State
  const [selectedManifestTripId, setSelectedManifestTripId] = useState<number | ''>('');
  const [manifestRows, setManifestRows] = useState<any[]>([]);
  const [manifestSummary, setManifestSummary] = useState<any | null>(null);
  const [loadingManifest, setLoadingManifest] = useState<boolean>(false);

  // Tab 6: Feedback Moderation State
  const [adminFeedback, setAdminFeedback] = useState<any[]>([]);

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
    try {
      await apiRequest('/fleet/buses', {
        method: 'POST',
        body: JSON.stringify({ busNo: newBusNo, totalSeats: Number(newBusSeats) }),
      });
      setBannerSuccess(`Bus ${newBusNo} registered with ${newBusSeats} physical seats.`);
      setNewBusNo('');
      loadFleet();
    } catch (err: any) {
      setBannerError(err.message || 'Failed to create bus.');
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
      await apiRequest('/routes', {
        method: 'POST',
        body: JSON.stringify({
          corridorId: newRouteCorridorId,
          routeName: newRouteName,
          origin: newRouteOrigin,
          destination: newRouteDestination,
          direction: newRouteDirection,
        }),
      });
      setBannerSuccess(`Route "${newRouteName}" registered.`);
      setNewRouteName('');
      setNewRouteOrigin('');
      setNewRouteDestination('');
      loadRoutesAndStops();
    } catch (err: any) {
      setBannerError(err.message || 'Failed to create route.');
    }
  };

  // -------------------------------------------------------------
  // Trip Handlers & 6:00 PM Audit
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

  const handleRun6PMAudit = async () => {
    try {
      setRunningAudit(true);
      setBannerError(null);
      const res = await apiRequest('/trips/audit/return-service-check');
      setAuditReport(res);
      setBannerSuccess(`Audit check complete: ${res.warningCount} warning(s) found.`);
    } catch (err: any) {
      setBannerError(err.message || 'Failed to execute return service audit.');
    } finally {
      setRunningAudit(false);
    }
  };

  // -------------------------------------------------------------
  // Manifest / Check-In Handlers
  // -------------------------------------------------------------
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
      setBannerSuccess(`Feedback #${feedbackId} moderation set to ${nextStatus}.`);
      loadAdminFeedback();
    } catch (err: any) {
      setBannerError(err.message || 'Failed to moderate feedback.');
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
          <span>Trip Scheduling & 6PM Audit</span>
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
                <div>
                  <label className="font-semibold block mb-1">Bus Number (e.g. RJ14-PA-1234)</label>
                  <input
                    type="text"
                    required
                    value={newBusNo}
                    onChange={(e) => setNewBusNo(e.target.value)}
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
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      {bus.status}
                    </span>
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
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      {d.status}
                    </span>
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
              <span className="text-[10px] text-neutral-400 uppercase font-mono block">Existing Corridors</span>
              {corridors.map((c) => (
                <div key={c.corridor_id} className="p-2 bg-neutral-50 dark:bg-neutral-950 rounded font-medium">
                  {c.corridor_name}
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
              <span className="text-[10px] text-neutral-400 uppercase font-mono block">Existing Stops</span>
              {stops.map((s) => (
                <div key={s.stop_id} className="p-1.5 bg-neutral-50 dark:bg-neutral-950 rounded text-[11px]">
                  {s.stop_name}
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

              <button
                type="submit"
                className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold"
              >
                Register Route
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: TRIP SCHEDULING & 6:00 PM AUDIT */}
      {/* ============================================================== */}
      {activeTab === 'trips' && (
        <div className="space-y-6">
          {/* 6:00 PM Return Service Audit Button & Report Card */}
          <div className="p-6 bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950 text-white rounded-2xl border border-amber-500/30 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>University Return Service Guarantee</span>
                </div>
                <h3 className="text-lg font-bold">
                  6:00 PM Return Shuttle Service Audit Check
                </h3>
                <p className="text-xs text-neutral-300 max-w-xl">
                  Inspects all scheduled OUTBOUND campus departures and verifies whether a corresponding ~6:00 PM (17:30–18:30) RETURN service is scheduled. Zero-fabrication enforcement: surfaces actionable audit alerts for transport managers.
                </p>
              </div>

              <button
                onClick={handleRun6PMAudit}
                disabled={runningAudit}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-2 shrink-0 transition-colors shadow-sm"
              >
                {runningAudit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                <span>Execute Return Service Audit</span>
              </button>
            </div>

            {auditReport && (
              <div className="p-4 rounded-xl bg-black/40 border border-amber-500/30 space-y-3 text-xs animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-neutral-700 pb-2">
                  <span className="font-mono text-amber-300 font-bold">
                    STATUS: {auditReport.auditStatus}
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    Checked {auditReport.totalOutboundDaysChecked} outbound day-corridors
                  </span>
                </div>

                {auditReport.warningCount === 0 ? (
                  <div className="text-emerald-400 flex items-center gap-2 font-medium">
                    <CheckCircle className="w-4 h-4" />
                    <span>Compliant: All scheduled outbound dates have corresponding 6:00 PM return service slots.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-amber-200 font-medium">
                      ⚠️ Found {auditReport.warningCount} deficient return service slot(s):
                    </p>
                    <ul className="space-y-1.5 text-rose-300 font-mono text-[11px]">
                      {auditReport.warnings.map((w: any, idx: number) => (
                        <li key={idx} className="p-2 rounded bg-rose-950/40 border border-rose-900/50">
                          {w.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

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

            <div className="flex items-center gap-2">
              <select
                value={selectedManifestTripId}
                onChange={(e) => {
                  setSelectedManifestTripId(e.target.value ? parseInt(e.target.value, 10) : '');
                  if (e.target.value) loadManifest(parseInt(e.target.value, 10));
                }}
                className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
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
                        : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {f.moderation_status}
                  </span>
                  <button
                    onClick={() => handleToggleFeedbackStatus(f.feedback_id, f.moderation_status)}
                    className="p-1.5 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    title={f.moderation_status === 'PUBLISHED' ? 'Hide Review' : 'Publish Review'}
                  >
                    {f.moderation_status === 'PUBLISHED' ? (
                      <EyeOff className="w-3.5 h-3.5 text-neutral-500" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
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
            <p className="text-xs text-neutral-500">
              User: <strong className="text-neutral-900 dark:text-neutral-100">{reviewNotesModalUser.full_name}</strong> ({reviewNotesModalUser.email})
            </p>

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
    </div>
  );
};
