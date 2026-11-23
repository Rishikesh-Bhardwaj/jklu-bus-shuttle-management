import React from 'react';
import { Bus, ShieldCheck, MapPin, ArrowRight, Clock, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HomeViewProps {
  setCurrentView: (view: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ setCurrentView }) => {
  const { user } = useAuth();

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-900 via-primary-800 to-neutral-900 text-white p-8 sm:p-12 shadow-lg">
        <div className="max-w-2xl space-y-4">
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
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
            Guaranteed 6:00 PM Return Service
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Scheduled return shuttle routes ensure day scholars and campus commuters have guaranteed transport back from city corridors.
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
            onClick={() => setCurrentView('trips')}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <span>See Timings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2 font-bold text-neutral-800 dark:text-neutral-200 mb-1">
              <MapPin className="w-3.5 h-3.5 text-primary-600" />
              <span>Corridor 1: Vaishali Nagar & 200 Ft Bypass</span>
            </div>
            <p className="text-neutral-500 text-[11px] leading-relaxed">
              Serving Queens Road, Amrapali Circle, Gandhi Path, and Ajmer Road junction.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2 font-bold text-neutral-800 dark:text-neutral-200 mb-1">
              <MapPin className="w-3.5 h-3.5 text-primary-600" />
              <span>Corridor 2: Mansarovar & Gopalpura</span>
            </div>
            <p className="text-neutral-500 text-[11px] leading-relaxed">
              Serving VT Road, Technology Park, B2 Bypass, and Mahaveer Nagar stops.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2 font-bold text-neutral-800 dark:text-neutral-200 mb-1">
              <MapPin className="w-3.5 h-3.5 text-primary-600" />
              <span>Corridor 3: Raja Park & Transport Nagar</span>
            </div>
            <p className="text-neutral-500 text-[11px] leading-relaxed">
              Serving Jawahar Nagar, LBS College, Tonk Phatak, and Sodala expressway.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
