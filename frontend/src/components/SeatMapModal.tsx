import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Loader2, Bus, MapPin } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface SeatInfo {
  seatId: number;
  seatNumber: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED_BY_YOU';
  isMySeat: boolean;
}

interface RouteStop {
  route_stop_id: number;
  stop_id: number;
  stop_order: number;
  stop_name: string;
  estimated_offset_minutes: number;
}

interface SeatMapModalProps {
  tripId: number;
  onClose: () => void;
  onBookingSuccess: (booking: any) => void;
}

export const SeatMapModal: React.FC<SeatMapModalProps> = ({
  tripId,
  onClose,
  onBookingSuccess,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [trip, setTrip] = useState<any>(null);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [seats, setSeats] = useState<SeatInfo[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<number | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<number | null>(null);

  useEffect(() => {
    async function loadTripDetails() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiRequest(`/trips/${tripId}`);
        setTrip(data.trip);
        const stopsList = data.routeStops || data.stops || data.trip?.stops || [];
        setRouteStops(stopsList);
        setSeats(data.seats || []);

        // Default to first route stop
        if (stopsList.length > 0) {
          setSelectedStopId(stopsList[0].stop_id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load trip seat layout.');
      } finally {
        setLoading(false);
      }
    }
    loadTripDetails();
  }, [tripId]);

  const handleBookSeat = async () => {
    if (!selectedSeatId) {
      setError('Please select an available seat.');
      return;
    }
    if (!selectedStopId) {
      setError('Please select your boarding stop.');
      return;
    }

    if (user?.verificationStatus !== 'VERIFIED') {
      setError(`Affiliation verification is ${user?.verificationStatus || 'PENDING'}. You can only book seats once verified.`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await apiRequest('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          tripId,
          seatId: selectedSeatId,
          boardingStopId: selectedStopId,
        }),
      });
      onBookingSuccess(res.booking);
    } catch (err: any) {
      setError(err.message || 'Seat reservation failed. The seat may have just been taken.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSeatObj = seats.find((s) => s.seatId === selectedSeatId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-primary-100 dark:bg-primary-950 text-primary-600 rounded-lg">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                Select Your Seat
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {trip?.route_name || 'Loading trip...'} ({trip?.direction})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              <p className="text-xs text-neutral-500">Loading seat layout from database...</p>
            </div>
          ) : (
            <>
              {/* Boarding Stop Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary-600" />
                  Select Boarding Stop
                </label>
                <select
                  value={selectedStopId || ''}
                  onChange={(e) => setSelectedStopId(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {routeStops.length === 0 ? (
                    <option value="">No boarding stops assigned to this route</option>
                  ) : (
                    routeStops.map((stop) => (
                      <option key={stop.stop_id} value={stop.stop_id}>
                        Stop #{stop.stop_order}: {stop.stop_name} (+{stop.estimated_offset_minutes}m)
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Seat Legend */}
              <div className="flex items-center justify-center gap-4 text-[11px] py-1 border-y border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800" />
                  <span className="text-neutral-600 dark:text-neutral-400">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-primary-600" />
                  <span className="text-neutral-600 dark:text-neutral-400">Selected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-neutral-300 dark:bg-neutral-700 opacity-60" />
                  <span className="text-neutral-600 dark:text-neutral-400">Occupied</span>
                </div>
              </div>

              {/* Bus Cabin Visual Layout */}
              <div className="bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
                {/* Driver / Front Cabin */}
                <div className="flex justify-between items-center pb-3 mb-4 border-b border-dashed border-neutral-300 dark:border-neutral-700 text-xs text-neutral-400 font-mono">
                  <span>[ENTRY DOOR]</span>
                  <span className="px-2 py-1 rounded bg-neutral-200 dark:bg-neutral-800 text-[10px] uppercase font-bold text-neutral-700 dark:text-neutral-300">
                    Driver Seat
                  </span>
                </div>

                {/* Seats Grid (4 columns representing 2x2 shuttle layout) */}
                <div className="grid grid-cols-4 gap-2.5">
                  {seats.map((seat, index) => {
                    const isSelected = selectedSeatId === seat.seatId;
                    const isOccupied = seat.status === 'OCCUPIED';
                    const isMySeat = seat.status === 'RESERVED_BY_YOU';

                    return (
                      <button
                        key={seat.seatId}
                        type="button"
                        disabled={isOccupied}
                        onClick={() => setSelectedSeatId(seat.seatId)}
                        className={`h-11 rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-400 scale-105'
                            : isMySeat
                            ? 'bg-emerald-50 dark:bg-emerald-950 border border-emerald-500 text-emerald-700 dark:text-emerald-300'
                            : isOccupied
                            ? 'bg-neutral-200 dark:bg-neutral-800/80 text-neutral-400 cursor-not-allowed opacity-50'
                            : 'bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:border-primary-500 hover:shadow-sm'
                        } ${index % 4 === 1 ? 'mr-3' : ''}`}
                        title={
                          isMySeat
                            ? `Seat ${seat.seatNumber} (Your reservation)`
                            : isOccupied
                            ? `Seat ${seat.seatNumber} (Reserved)`
                            : `Seat ${seat.seatNumber} (Click to select)`
                        }
                      >
                        <span>{seat.seatNumber}</span>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-between">
          <div className="text-xs">
            {selectedSeatObj ? (
              <span className="text-neutral-700 dark:text-neutral-300">
                Selected: <strong className="text-primary-600">Seat {selectedSeatObj.seatNumber}</strong>
              </span>
            ) : (
              <span className="text-neutral-400">No seat selected</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleBookSeat}
              disabled={submitting || !selectedSeatId || loading}
              className="px-4 py-1.5 text-xs font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Reservation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

