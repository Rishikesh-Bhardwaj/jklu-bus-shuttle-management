import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  Clock,
  ShieldAlert,
  Bus,
  Calendar,
  Ticket,
  ArrowRight,
  RotateCcw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

interface DashboardViewProps {
  setCurrentView: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setCurrentView }) => {
  const { user, reapplyVerification } = useAuth();
  const [reapplying, setReapplying] = useState<boolean>(false);
  const [showReapplyModal, setShowReapplyModal] = useState<boolean>(false);
  const [reapplyNotes, setReapplyNotes] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState<boolean>(true);

  useEffect(() => {
    async function fetchBookings() {
      try {
        setLoadingBookings(true);
        const data = await apiRequest('/bookings/my');
        setActiveBookings(data.bookings || []);
      } catch {
        setActiveBookings([]);
      } finally {
        setLoadingBookings(false);
      }
    }
    if (user) {
      fetchBookings();
    }
  }, [user]);

  const handleReapply = async () => {
    try {
      setReapplying(true);
      setActionError(null);
      await reapplyVerification(reapplyNotes);
      setShowReapplyModal(false);
      setReapplyNotes('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit reapplication.');
    } finally {
      setReapplying(false);
    }
  };

  const confirmedBookings = activeBookings.filter((b) => b.booking_status === 'CONFIRMED');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Verification Status Alert Banner */}
      {user && user.role !== 'MANAGER' && (
        <div>
          {user.verificationStatus === 'VERIFIED' && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-emerald-900 dark:text-emerald-100">
                    Affiliation Verified
                  </h4>
                  <p className="text-emerald-700 dark:text-emerald-300">
                    Your university identity is confirmed. Full seat booking access is active.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCurrentView('trips')}
                className="hidden sm:inline-flex px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors shadow-sm"
              >
                Book a Seat
              </button>
            </div>
          )}

          {user.verificationStatus === 'PENDING' && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-amber-900 dark:text-amber-100">
                    Affiliation Review Pending
                  </h4>
                  <p className="text-amber-700 dark:text-amber-300">
                    Your student/faculty affiliation is currently under review by the Transport Desk. Seat booking will be enabled upon approval.
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-md bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-mono font-medium">
                PENDING APPROVAL
              </span>
            </div>
          )}

          {user.verificationStatus === 'REJECTED' && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-3">
                <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-rose-900 dark:text-rose-100">
                    Affiliation Verification Rejected
                  </h4>
                  <p className="text-rose-700 dark:text-rose-300">
                    {user.verificationNotes
                      ? `Reason: ${user.verificationNotes}`
                      : 'Your affiliation details could not be validated against campus records.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReapplyModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-sm self-start sm:self-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reapply for Verification</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Profile Overview Card */}
      <div className="p-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase text-primary-600 dark:text-primary-400 font-semibold tracking-wider">
            {user?.role} {user?.studentCategory ? `• ${user.studentCategory}` : ''}
          </span>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            Welcome back, {user?.fullName}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {user?.email} {user?.phoneNumber ? `• ${user.phoneNumber}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentView('trips')}
            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Bus className="w-4 h-4" />
            <span>Search Shuttles</span>
          </button>
          <button
            onClick={() => setCurrentView('my-bookings')}
            className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Ticket className="w-4 h-4" />
            <span>My Passes ({confirmedBookings.length})</span>
          </button>
        </div>
      </div>

      {/* Active Bookings Summary */}
      <div className="p-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
              Upcoming Booked Passes
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Your confirmed shuttle reservations
            </p>
          </div>
          <button
            onClick={() => setCurrentView('my-bookings')}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loadingBookings ? (
          <div className="py-8 flex justify-center text-xs text-neutral-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span>Loading passes...</span>
          </div>
        ) : confirmedBookings.length === 0 ? (
          <div className="py-10 text-center text-xs text-neutral-500 dark:text-neutral-400 space-y-2">
            <Ticket className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto" />
            <p>You have no active shuttle reservations.</p>
            {user?.verificationStatus === 'VERIFIED' ? (
              <button
                onClick={() => setCurrentView('trips')}
                className="text-primary-600 font-semibold hover:underline"
              >
                Browse scheduled trips and reserve a seat →
              </button>
            ) : (
              <p className="text-[11px] text-neutral-400">
                Seat booking will be unlocked once your affiliation is approved.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {confirmedBookings.slice(0, 2).map((b) => (
              <div
                key={b.booking_id}
                className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex justify-between items-start text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      {b.route_name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-semibold">
                      Seat {b.seat_number}
                    </span>
                  </div>
                  <p className="text-neutral-500">
                    Boarding Stop: <strong className="text-neutral-700 dark:text-neutral-300">{b.boarding_stop_name}</strong>
                  </p>
                  <div className="flex items-center gap-3 text-neutral-400 text-[11px] pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(b.trip_date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {b.departure_time}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setCurrentView('my-bookings')}
                  className="px-2.5 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium hover:border-primary-500 transition-colors"
                >
                  Pass
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reapplication Modal */}
      {showReapplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
              <RotateCcw className="w-5 h-5" />
              <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                Reapply for Affiliation Verification
              </h3>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Provide clarification or updated details regarding your university enrollment / faculty department for the transport desk to re-evaluate.
            </p>

            {actionError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <textarea
              value={reapplyNotes}
              onChange={(e) => setReapplyNotes(e.target.value)}
              placeholder="e.g. Enrolled in B.Tech CSE 3rd Year, Roll No: 2023BTECH042..."
              rows={3}
              className="w-full p-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
            />

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowReapplyModal(false)}
                disabled={reapplying}
                className="px-3.5 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReapply}
                disabled={reapplying}
                className="px-4 py-1.5 text-xs font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {reapplying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Submit Reapplication</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

