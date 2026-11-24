import React, { useState, useEffect } from 'react';
import { Bus, ShieldCheck, MapPin, ArrowRight, Clock, Star, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CampusSlideshow } from '../components/CampusSlideshow';
import { apiRequest } from '../lib/api';

interface HomeViewProps {
  setCurrentView: (view: string) => void;
}

interface CorridorCardData {
  corridorId: number;
  corridorName: string;
  description?: string | null;
  stops: string[];
  timings: string[];
}

function formatDepartureTime(timeStr?: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  }
  return timeStr;
}

export const HomeView: React.FC<HomeViewProps> = ({ setCurrentView }) => {
  const { user } = useAuth();
  const [corridors, setCorridors] = useState<CorridorCardData[]>([]);
  const [loadingCorridors, setLoadingCorridors] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchCorridorsAndTimings() {
      try {
        setLoadingCorridors(true);

        const [corridorsRes, routesRes, tripsRes] = await Promise.allSettled([
          apiRequest('/routes/corridors'),
          apiRequest('/routes'),
          apiRequest('/trips'),
        ]);

        if (!isMounted) return;

        const rawCorridors: any[] =
          corridorsRes.status === 'fulfilled' && corridorsRes.value?.corridors
            ? corridorsRes.value.corridors
            : [];
        const rawRoutes: any[] =
          routesRes.status === 'fulfilled' && routesRes.value?.routes
            ? routesRes.value.routes
            : [];
        const rawTrips: any[] =
          tripsRes.status === 'fulfilled' && tripsRes.value?.trips
            ? tripsRes.value.trips
            : [];

        // Build corridor cards only when supported by actual available data
        const cards: CorridorCardData[] = rawCorridors.map((c: any) => {
          const matchingRoutes = rawRoutes.filter(
            (r: any) => r.corridor_id === c.corridor_id
          );

          // Extract unique verified stops from actual route_stops
          const stopNames = new Set<string>();
          matchingRoutes.forEach((r: any) => {
            if (Array.isArray(r.stops)) {
              r.stops.forEach((s: any) => {
                if (s.stop_name) stopNames.add(s.stop_name);
              });
            }
          });

          // Extract real departure timings from scheduled trips for this corridor
          const timingSet = new Set<string>();
          rawTrips.forEach((t: any) => {
            const belongsToCorridor =
              t.corridor_id === c.corridor_id ||
              matchingRoutes.some((r: any) => r.route_id === t.route_id);

            if (belongsToCorridor && t.departure_time) {
              timingSet.add(formatDepartureTime(t.departure_time));
            }
          });

          return {
            corridorId: c.corridor_id,
            corridorName: c.corridor_name,
            description: c.description || null,
            stops: Array.from(stopNames),
            timings: Array.from(timingSet),
          };
        });

        setCorridors(cards);
      } catch {
        if (isMounted) setCorridors([]);
      } finally {
        if (isMounted) setLoadingCorridors(false);
      }
    }

    fetchCorridorsAndTimings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSeeTimings = (corridorId?: number) => {
    if (corridorId !== undefined) {
      sessionStorage.setItem('preferred_corridor', String(corridorId));
    } else {
      sessionStorage.removeItem('preferred_corridor');
    }
    setCurrentView(user ? 'trips' : 'login');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Hero Banner with scoped campus slideshow */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900 text-white p-8 sm:p-12 shadow-lg">
        <CampusSlideshow />
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-700/60 text-primary-200 text-xs font-medium backdrop-blur-sm">
            <Bus className="w-3.5 h-3.5" />
            <span>Official JKLU Campus Transportation</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Reliable, Safe & Scheduled Campus Shuttle Services
          </h1>

          <p className="text-primary-100 text-sm sm:text-base leading-relaxed">
            Direct transit connecting JK Lakshmipat University campus with Jaipur corridors. Reserve individual seats in real-time, view verified manifests, and track departure timings.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => setCurrentView('trips')}
              className="px-5 py-2.5 rounded-lg bg-white text-primary-900 font-semibold text-xs sm:text-sm hover:bg-primary-50 transition-colors shadow-md flex items-center gap-2"
            >
              <span>Explore Shuttle Schedules</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {!user ? (
              <button
                onClick={() => setCurrentView('register')}
                className="px-5 py-2.5 rounded-lg bg-primary-700 hover:bg-primary-600 text-white font-semibold text-xs sm:text-sm transition-colors border border-primary-500/40"
              >
                Register Account
              </button>
            ) : (
              <button
                onClick={() => setCurrentView('my-bookings')}
                className="px-5 py-2.5 rounded-lg bg-primary-700 hover:bg-primary-600 text-white font-semibold text-xs sm:text-sm transition-colors border border-primary-500/40"
              >
                View My Passes
              </button>
            )}
          </div>
        </div>

        {/* Decorative corner icon */}
        <div className="absolute right-4 bottom-4 opacity-10 pointer-events-none hidden sm:block">
          <Bus className="w-64 h-64 text-white" />
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-950 text-primary-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
            Strict Affiliation Security
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            All passengers are verified students or faculty members. Unverified accounts cannot reserve seats, guaranteeing campus safety.
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
            <Bus className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
            Real-Time Seat Booking
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Browse published shuttle trips, select available seats from interactive cabin layouts, and choose your designated boarding stop.
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
            <Star className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
            Transparent Feedback & Moderation
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Passengers submit verified ratings on punctuality, driver courtesy, and cleanliness, tracked by the university transport desk.
          </p>
        </div>
      </div>

      {/* University Shuttle Corridors Info Section */}
      <div className="p-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
              Campus Transit Corridors
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Official university route coverage across Jaipur
            </p>
          </div>
          <button
            onClick={() => handleSeeTimings()}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 focus:outline-none"
          >
            <span>See Timings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loadingCorridors ? (
          <div className="py-8 flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 text-xs gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
            <span>Loading verified corridor schedules...</span>
          </div>
        ) : corridors.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            {corridors.map((c) => (
              <div
                key={c.corridorId}
                className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-bold text-neutral-800 dark:text-neutral-200">
                    <MapPin className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                    <span>{c.corridorName}</span>
                  </div>

                  {c.stops.length > 0 ? (
                    <p className="text-neutral-500 text-[11px] leading-relaxed">
                      Stops: {c.stops.join(' • ')}
                    </p>
                  ) : c.description ? (
                    <p className="text-neutral-500 text-[11px] leading-relaxed">
                      {c.description}
                    </p>
                  ) : (
                    <p className="text-neutral-400 dark:text-neutral-500 text-[11px] italic">
                      Stops assigned per scheduled manifest
                    </p>
                  )}

                  {/* Departure Timings */}
                  {c.timings.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-700 dark:text-neutral-300 pt-1">
                      <Clock className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                      <span>Departures: {c.timings.join(', ')}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 italic pt-1">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>Timings currently unavailable</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-neutral-200/60 dark:border-neutral-800/60">
                  <button
                    onClick={() => handleSeeTimings(c.corridorId)}
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 focus:outline-none"
                  >
                    <span>See Timings</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 px-4 text-center rounded-lg bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800 space-y-2">
            <MapPin className="w-5 h-5 mx-auto text-neutral-400 dark:text-neutral-500" />
            <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              No corridor routes or timings currently published
            </p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
              Route coverage and departure schedules are posted by the university transport desk as active manifests are scheduled.
            </p>
            <div className="pt-1">
              <button
                onClick={() => handleSeeTimings()}
                className="text-xs font-semibold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 focus:outline-none"
              >
                <span>Check Live Shuttle Schedules</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
