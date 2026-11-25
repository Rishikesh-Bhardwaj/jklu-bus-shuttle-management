import React, { useState, useEffect } from 'react';
import {
  Ticket,
  Calendar,
  Clock,
  Bus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  QrCode,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface MyBookingsViewProps {
  setCurrentView: (view: string) => void;
}

export const MyBookingsView: React.FC<MyBookingsViewProps> = ({ setCurrentView }) => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Cancellation State
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelModalBooking, setCancelModalBooking] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Personal schedule change');
  const [selectedPass, setSelectedPass] = useState<any | null>(null);
  const [loadingPassId, setLoadingPassId] = useState<number | null>(null);
  const dismissedStorageKey = `jklu-hidden-cancelled-passes-${user?.userId ?? 'guest'}`;
  const [dismissedCancelledIds, setDismissedCancelledIds] = useState<number[]>([]);
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);
  const [scannerBusy, setScannerBusy] = useState<boolean>(false);
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const scannerVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = React.useRef<MediaStream | null>(null);
  const scannerTimerRef = React.useRef<number | null>(null);
  const scannerProcessingRef = React.useRef<boolean>(false);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest('/bookings/my');
      setBookings(data.bookings || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(dismissedStorageKey);
      setDismissedCancelledIds(saved ? JSON.parse(saved) : []);
    } catch {
      setDismissedCancelledIds([]);
    }
  }, [dismissedStorageKey]);

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => () => {
    if (scannerTimerRef.current !== null) window.clearInterval(scannerTimerRef.current);
    scannerStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const handleCancelBooking = async () => {
    if (!cancelModalBooking) return;
    try {
      setCancellingId(cancelModalBooking.booking_id);
      await apiRequest(`/bookings/${cancelModalBooking.booking_id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      });
      setCancelModalBooking(null);
      fetchBookings();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel booking.');
    } finally {
      setCancellingId(null);
    }
  };

  const activeBookings = bookings.filter(
    (booking) => booking.booking_status === 'CONFIRMED' && !['CANCELLED', 'DELETED'].includes(booking.trip_status)
  );
  const cancelledBookings = bookings.filter(
    (booking) =>
      (booking.booking_status === 'CANCELLED' || ['CANCELLED', 'DELETED'].includes(booking.trip_status)) &&
      !dismissedCancelledIds.includes(Number(booking.booking_id))
  );

  const handleRemoveCancelledPass = (bookingId: number) => {
    setDismissedCancelledIds((current) => {
      const next = [...new Set([...current, bookingId])];
      try {
        localStorage.setItem(dismissedStorageKey, JSON.stringify(next));
      } catch {
        setError('Could not save this display preference in your browser.');
      }
      return next;
    });
  };

  const stopBusQrScanner = () => {
    if (scannerTimerRef.current !== null) {
      window.clearInterval(scannerTimerRef.current);
      scannerTimerRef.current = null;
    }
    scannerStreamRef.current?.getTracks().forEach((track) => track.stop());
    scannerStreamRef.current = null;
    if (scannerVideoRef.current) scannerVideoRef.current.srcObject = null;
    setScannerOpen(false);
    setScannerBusy(false);
  };

  const startBusQrScanner = async () => {
    setScannerMessage(null);
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      setScannerMessage('QR scanning is not supported by this browser. Please use an updated Chrome browser on your phone.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerMessage('Camera access requires HTTPS and browser permission.');
      return;
    }

    try {
      setScannerBusy(true);
      setScannerOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      scannerStreamRef.current = stream;
      const video = scannerVideoRef.current;
      if (!video) throw new Error('Camera preview could not be initialized.');
      video.srcObject = stream;
      await video.play();

      const detector = new Detector({ formats: ['qr_code'] });
      scannerTimerRef.current = window.setInterval(async () => {
        if (scannerProcessingRef.current || !video.videoWidth) return;
        try {
          const codes = await detector.detect(video);
          const token = codes?.[0]?.rawValue;
          if (!token || scannerProcessingRef.current) return;
          scannerProcessingRef.current = true;
          stopBusQrScanner();
          const result = await apiRequest('/check-ins/scan', {
            method: 'POST',
            body: JSON.stringify({ token }),
          });
          setScannerMessage(result.message || 'Boarding confirmed!');
          await fetchBookings();
        } catch (err: any) {
          setScannerMessage(err.message || 'Unable to verify this bus QR code.');
        } finally {
          scannerProcessingRef.current = false;
        }
      }, 500);
      setScannerBusy(false);
    } catch (err: any) {
      stopBusQrScanner();
      setScannerMessage(err.message || 'Unable to access the camera. Check browser camera permissions.');
    } finally {
      setScannerBusy(false);
    }
  };

  const handleOpenPass = async (booking: any) => {
    try {
      setLoadingPassId(booking.booking_id);
      const data = await apiRequest(`/bookings/${booking.booking_id}`);
      if (!data.boardingPass?.verified || !data.boardingPass?.qrPayload) {
        setError('This boarding pass is no longer valid.');
        return;
      }
      setSelectedPass(data);
    } catch (err: any) {
      setError(err.message || 'Unable to open boarding pass.');
    } finally {
      setLoadingPassId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary-600" />
            <span>My Digital Boarding Passes</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Official seat reservations for JKLU campus shuttles
          </p>
        </div>

        <button
          onClick={() => setCurrentView('trips')}
          className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm self-start sm:self-auto"
        >
          <Bus className="w-4 h-4" />
          <span>Book Another Shuttle</span>
        </button>
      </div>

      <section className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">Automatic Bus Check-In</h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">When you are at the shuttle, scan the temporary QR displayed by the driver. Your confirmed booking will be checked in automatically.</p>
          </div>
          {!scannerOpen ? (
            <button type="button" onClick={startBusQrScanner} disabled={scannerBusy} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold">
              {scannerBusy ? 'Starting camera…' : 'Scan Bus QR'}
            </button>
          ) : (
            <button type="button" onClick={stopBusQrScanner} className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-800 text-white text-xs font-semibold">Stop Camera</button>
          )}
        </div>
        {scannerOpen && (
          <video ref={scannerVideoRef} autoPlay muted playsInline className="w-full max-w-sm mx-auto rounded-xl bg-black aspect-video object-cover" />
        )}
        {scannerMessage && <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{scannerMessage}</p>}
      </section>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <p className="text-xs text-neutral-500">Retrieving digital passes...</p>
        </div>
      ) : activeBookings.length === 0 && cancelledBookings.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 space-y-3">
          <Ticket className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto" />
          <h3 className="font-bold text-sm text-neutral-800 dark:text-neutral-200">
            No Bookings Found
          </h3>
          <p className="text-xs max-w-sm mx-auto">
            You currently have no active shuttle passes. Cancelled bookings are kept in the system for transport records.
          </p>
          <button
            onClick={() => setCurrentView('trips')}
            className="px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition-colors shadow-sm"
          >
            Explore Available Shuttles
          </button>
        </div>
      ) : (
        <div className="space-y-8">
        {activeBookings.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeBookings.map((b) => {
            const isTripCancelled = ['CANCELLED', 'DELETED'].includes(b.trip_status);
            const isConfirmed = b.booking_status === 'CONFIRMED' && !isTripCancelled;
            const isBoarded = b.check_in_status === 'BOARDED';

            return (
              <div
                key={b.booking_id}
                className={`bg-white dark:bg-neutral-900 rounded-2xl border shadow-sm overflow-hidden flex flex-col justify-between transition-colors ${
                  isTripCancelled
                    ? 'border-rose-200 dark:border-rose-900/60 opacity-75'
                    : isConfirmed
                    ? 'border-neutral-200 dark:border-neutral-800'
                    : 'border-neutral-200 dark:border-neutral-800 opacity-60'
                }`}
              >
                {/* Pass Header */}
                <div className={`p-4 text-white flex items-center justify-between ${
                  isTripCancelled ? 'bg-neutral-800' : 'bg-primary-900'
                }`}>
                  <div className="flex items-center space-x-2">
                    <Bus className={`w-4 h-4 ${isTripCancelled ? 'text-rose-400' : 'text-primary-300'}`} />
                    <span className="font-bold text-xs uppercase tracking-wider">
                      {b.trip_status === 'DELETED' ? 'JKLU Boarding Pass (Trip Deleted)' : isTripCancelled ? 'JKLU Boarding Pass (Cancelled)' : 'JKLU Boarding Pass'}
                    </span>
                  </div>
                  <span className={`font-mono text-[11px] px-2 py-0.5 rounded font-semibold ${
                    isTripCancelled ? 'bg-rose-950 text-rose-300' : 'bg-primary-800 text-primary-200'
                  }`}>
                    Booking #{b.booking_id}
                  </span>
                </div>

                {/* Pass Body */}
                <div className="p-5 space-y-4 text-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                        {b.route_name}
                      </h3>
                      <p className="text-neutral-500 text-[11px]">
                        Corridor: {b.corridor_name} ({b.direction})
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-mono text-neutral-400 block">
                        Assigned Seat
                      </span>
                      <span className={`text-lg font-extrabold font-mono ${
                        isTripCancelled
                          ? 'text-neutral-400 line-through'
                          : 'text-primary-600 dark:text-primary-400'
                      }`}>
                        {b.seat_number}
                      </span>
                    </div>
                  </div>

                  {/* Trip Details Grid */}
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 grid grid-cols-2 gap-3 font-mono text-[11px]">
                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase block">Trip ID</span>
                      <span className="font-bold text-neutral-800 dark:text-neutral-200">#{b.trip_id}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase block">Departure</span>
                      <span className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-primary-600" />
                        {b.departure_time}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase block">Date</span>
                      <span className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-neutral-400" />
                        {new Date(b.trip_date).toLocaleDateString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase block">Boarding Stop</span>
                      <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate block">
                        {b.boarding_stop_name}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase block">Bus No.</span>
                      <span className="font-bold text-neutral-800 dark:text-neutral-200">
                        {b.bus_no}
                      </span>
                    </div>
                  </div>

                  {/* Boarding Verification QR & Status */}
                  <div className={`p-3 rounded-xl border border-dashed flex items-center justify-between ${
                    isTripCancelled
                      ? 'border-rose-300 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        isTripCancelled
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-500 opacity-60'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                      }`}>
                        <QrCode className="w-7 h-7" />
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 font-mono block">
                          {b.trip_status === 'DELETED' ? 'Pass Inactive (Trip Deleted)' : isTripCancelled ? 'Pass Inactive (Trip Cancelled)' : `Pass Code: JKLU-T${b.trip_id}-S${b.seat_number}`}
                        </span>
                        <div className="flex items-center gap-1.5 font-semibold text-xs mt-0.5">
                          {isTripCancelled ? (
                            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold">
                              <XCircle className="w-3.5 h-3.5" />
                              {b.trip_status === 'DELETED' ? 'Trip Deleted by Manager' : 'Trip Cancelled by Transport'}
                            </span>
                          ) : isBoarded ? (
                            <span className="text-emerald-600 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              Boarded ({b.boarded_at ? new Date(b.boarded_at).toLocaleTimeString() : ''})
                            </span>
                          ) : isConfirmed ? (
                            <span className="text-primary-600 flex items-center gap-1">
                              <Ticket className="w-3.5 h-3.5" />
                              Ready for Boarding
                            </span>
                          ) : (
                            <span className="text-rose-600 flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" />
                              Booking Cancelled
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isConfirmed && (
                        <button
                          onClick={() => handleOpenPass(b)}
                          disabled={loadingPassId === b.booking_id}
                          className="px-2.5 py-1 text-xs text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded border border-primary-200 dark:border-primary-900 transition-colors disabled:opacity-50"
                        >
                          {loadingPassId === b.booking_id ? 'Opening...' : 'View QR'}
                        </button>
                      )}
                      {isConfirmed && !isBoarded && (
                        <button
                          onClick={() => setCancelModalBooking(b)}
                          className="px-2.5 py-1 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded border border-rose-200 dark:border-rose-900 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer status notice */}
                <div className="px-5 py-2.5 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-100 dark:border-neutral-800 text-[10px] text-neutral-400 flex items-center justify-between">
                  <span>Reserved on {new Date(b.booking_time).toLocaleString()}</span>
                  <span>Passenger: {user?.fullName}</span>
                </div>
              </div>
            );
          })}
        </div>}
        {cancelledBookings.length > 0 && (
          <section className="space-y-3">
            <div>
              <h3 className="font-bold text-sm text-neutral-800 dark:text-neutral-200">Cancelled Passes</h3>
              <p className="text-xs text-neutral-500">These passes are inactive. Removing one hides it from this browser only; the official booking history remains safely stored in the system.</p>
            </div>
            <div className="space-y-2">
              {cancelledBookings.map((b) => (
                <div key={b.booking_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-neutral-800 dark:text-neutral-200">Booking #{b.booking_id} · {b.route_name}</p>
                    <p className="text-[11px] text-neutral-500">{new Date(b.trip_date).toLocaleDateString()} · Seat {b.seat_number} · {b.trip_status === 'DELETED' ? 'Trip Deleted by Manager' : b.trip_status === 'CANCELLED' ? 'Trip Cancelled by Transport' : 'Booking Cancelled'}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveCancelledPass(Number(b.booking_id))}
                    className="shrink-0 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Remove from My Passes
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        </div>
      )}

      {/* Boarding Pass QR Modal */}
      {selectedPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 max-w-sm w-full p-6 space-y-4 text-center">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">Digital Boarding Pass</h3>
              <button onClick={() => setSelectedPass(null)} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white text-xl" aria-label="Close boarding pass">×</button>
            </div>
            <p className="text-xs text-neutral-500">Booking #{selectedPass.booking.booking_id} · Trip #{selectedPass.booking.trip_id} · Seat {selectedPass.booking.seat_number}</p>
            <div className="mx-auto w-fit rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white p-3">
              <img
                src={`https://quickchart.io/qr?size=220&text=${encodeURIComponent(selectedPass.boardingPass.qrPayload)}`}
                alt="Boarding pass QR code"
                className="w-52 h-52"
              />
            </div>
            <div className="text-xs text-neutral-600 dark:text-neutral-300 space-y-1">
              <p className="font-semibold">{selectedPass.booking.route_name}</p>
              <p>{new Date(selectedPass.booking.trip_date).toLocaleDateString()} · {selectedPass.booking.departure_time}</p>
              <p>Boarding stop: {selectedPass.booking.boarding_stop_name}</p>
            </div>
            <p className="text-[10px] text-neutral-400">Show this QR code to the transport staff when boarding.</p>
            <button onClick={() => setSelectedPass(null)} className="w-full px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold">Close Pass</button>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                Cancel Shuttle Booking #{cancelModalBooking.booking_id}?
              </h3>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Your reservation for <strong className="text-neutral-900 dark:text-neutral-100">Seat {cancelModalBooking.seat_number}</strong> on {cancelModalBooking.route_name} will be released immediately for other campus commuters.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Cancellation Reason
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Schedule change, work from home..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setCancelModalBooking(null)}
                disabled={cancellingId !== null}
                className="px-3.5 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
              >
                Keep Reservation
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={cancellingId !== null}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {cancellingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Cancellation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
