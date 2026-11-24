import React, { useState, useEffect } from 'react';
import {
  Bus,
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle,
  Loader2,
  AlertCircle,
  User,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SeatMapModal } from '../components/SeatMapModal';

interface TripsViewProps {
  setCurrentView: (view: string) => void;
  initialCategory?: string;
}

export const TripsView: React.FC<TripsViewProps> = ({ setCurrentView, initialCategory }) => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<any[]>([]);
  const [corridors, setCorridors] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedDirection, setSelectedDirection] = useState<string>('');
  const [selectedCorridor, setSelectedCorridor] = useState<string>(() => {
    return sessionStorage.getItem('preferred_corridor') || '';
  });
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || '');

  // Booking Modal
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);

  const fetchTripsAndCorridors = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedDate) params.append('date', selectedDate);
      if (selectedDirection) params.append('direction', selectedDirection);
      if (selectedCorridor) params.append('corridorId', selectedCorridor);
      if (selectedCategory) params.append('category', selectedCategory);

      const [tripData, corridorData] = await Promise.all([
        apiRequest(`/trips?${params.toString()}`),
        apiRequest('/routes/corridors').catch(() => ({ corridors: [] })),
      ]);

      setTrips(tripData.trips || []);
      setCorridors(corridorData.corridors || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch trips.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTripsAndCorridors();
  }, [selectedDate, selectedDirection, selectedCorridor, selectedCategory]);

  const handleBookingComplete = (booking: any) => {
    setSelectedTripId(null);
    setBookingSuccessMsg(`Seat ${booking.seatNumber} reserved successfully! Booking ID #${booking.bookingId}`);
    fetchTripsAndCorridors();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Bus className="w-5 h-5 text-primary-600" />
            <span>{selectedCategory === 'EXTRA' ? 'Special & Extra Shuttles' : 'Campus Shuttle Schedules'}</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Real-time seat availability across university transport corridors
          </p>
        </div>

        {user && user.verificationStatus !== 'VERIFIED' && user.role !== 'MANAGER' && (
          <div className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Affiliation verification is {user.verificationStatus}. Booking will be enabled upon approval.</span>
          </div>
        )}
      </div>

      {bookingSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{bookingSuccessMsg}</span>
          </div>
          <button
            onClick={() => setCurrentView('my-bookings')}
            className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            View Boarding Pass
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="font-semibold text-neutral-600 dark:text-neutral-300 block mb-1">
            Trip Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="font-semibold text-neutral-600 dark:text-neutral-300 block mb-1">
            Direction
          </label>
          <select
            value={selectedDirection}
            onChange={(e) => setSelectedDirection(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Directions</option>
            <option value="OUTBOUND">Outbound (JKLU → City)</option>
            <option value="RETURN">Return (City → JKLU)</option>
          </select>
        </div>

        <div>
          <label className="font-semibold text-neutral-600 dark:text-neutral-300 block mb-1">
            Corridor
          </label>
          <select
            value={selectedCorridor}
            onChange={(e) => {
              setSelectedCorridor(e.target.value);
              if (e.target.value) {
                sessionStorage.setItem('preferred_corridor', e.target.value);
              } else {
                sessionStorage.removeItem('preferred_corridor');
              }
            }}
            className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Corridors</option>
            {corridors.map((c) => (
              <option key={c.corridor_id} value={c.corridor_id}>
                {c.corridor_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-semibold text-neutral-600 dark:text-neutral-300 block mb-1">
            Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Categories</option>
            <option value="STANDARD">Standard Scheduled</option>
            <option value="EXTRA">Special / Extra</option>
          </select>
        </div>
      </div>

      {/* Trips Cards List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <p className="text-xs text-neutral-500">Querying shuttle database...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : trips.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 space-y-3">
          <Bus className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto" />
          <h3 className="font-bold text-sm text-neutral-800 dark:text-neutral-200">
            No Shuttle Trips Found
          </h3>
          <p className="text-xs max-w-sm mx-auto">
            No scheduled trips match your filter criteria. Zero fake data is generated. Managers schedule real shuttles through the management portal.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trips.map((trip) => {
            const isFull = trip.available_seats_count <= 0;
            const canBook = user && user.verificationStatus === 'VERIFIED' && !isFull && trip.trip_status === 'PUBLISHED';

            return (
              <div
                key={trip.trip_id}
                className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-5 flex flex-col justify-between space-y-4 hover:border-primary-300 transition-colors"
              >
                <div className="space-y-3 text-xs">
                  {/* Badges */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                        trip.direction === 'OUTBOUND'
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {trip.direction}
                    </span>

                    {trip.trip_category === 'EXTRA' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                        EXTRA TRIP
                      </span>
                    )}

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        trip.trip_status === 'SCHEDULED'
                          ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                          : trip.trip_status === 'PUBLISHED'
                          ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {trip.trip_status}
                    </span>
                  </div>

                  {/* Route & Corridor */}
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {trip.route_name}
                    </h3>
                    <p className="text-neutral-500 text-[11px]">
                      {trip.origin} → {trip.destination}
                    </p>
                    <span className="text-[10px] text-primary-600 font-medium block mt-0.5">
                      Corridor: {trip.corridor_name}
                    </span>
                  </div>

                  {/* Time and Date */}
                  <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 space-y-1 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-neutral-700 dark:text-neutral-300">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                        {new Date(trip.trip_date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1.5 font-bold text-neutral-900 dark:text-neutral-100">
                        <Clock className="w-3.5 h-3.5 text-primary-600" />
                        {trip.departure_time}
                      </span>
                    </div>
                  </div>

                  {/* Bus & Driver Info */}
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Bus className="w-3.5 h-3.5 text-neutral-400" />
                      Bus: {trip.bus_no}
                    </span>
                    {trip.driver_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-neutral-400" />
                        Driver: {trip.driver_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                  <div className="text-[11px]">
                    <span
                      className={`font-bold ${
                        isFull
                          ? 'text-rose-600'
                          : trip.available_seats_count < 5
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {trip.available_seats_count}
                    </span>
                    <span className="text-neutral-400"> / {trip.total_no_of_seats} seats free</span>
                  </div>

                  <button
                    disabled={!canBook}
                    onClick={() => setSelectedTripId(trip.trip_id)}
                    className="px-3.5 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:hover:bg-primary-600 text-white font-semibold transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <span>
                      {isFull
                        ? 'Sold Out'
                        : trip.trip_status !== 'PUBLISHED'
                        ? trip.trip_status
                        : 'Select Seat'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Seat Map Modal */}
      {selectedTripId && (
        <SeatMapModal
          tripId={selectedTripId}
          onClose={() => setSelectedTripId(null)}
          onBookingSuccess={handleBookingComplete}
        />
      )}
    </div>
  );
};
