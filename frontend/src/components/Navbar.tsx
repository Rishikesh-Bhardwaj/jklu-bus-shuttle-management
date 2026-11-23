import React from 'react';
import { Bus, Moon, Sun, LogOut, User as UserIcon, ShieldAlert, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  darkMode,
  setDarkMode,
}) => {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Brand - Official JKLU Logo at Extreme Top-Left */}
        <div
          className="flex items-center space-x-3 cursor-pointer select-none"
          onClick={() => setCurrentView('home')}
        >
          <img
            src="/images/jklu-logo.png"
            alt="JK Lakshmipat University Logo"
            className="h-9 sm:h-11 w-auto max-w-[130px] sm:max-w-[160px] object-contain shrink-0"
          />
          <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800 hidden sm:block" />
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-primary-600 text-white rounded-lg shadow-sm hidden xs:block">
              <Bus className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm sm:text-base text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 leading-tight">
                Shuttle Portal
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 rounded font-semibold hidden md:inline-block">
                  Campus Bus
                </span>
              </span>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 hidden sm:block leading-none mt-0.5">
                JK Lakshmipat University, Jaipur
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1 text-sm font-medium">
          <button
            onClick={() => setCurrentView('home')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              currentView === 'home'
                ? 'bg-neutral-100 dark:bg-neutral-800 text-primary-600 dark:text-primary-400 font-semibold'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => setCurrentView('trips')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              currentView === 'trips'
                ? 'bg-neutral-100 dark:bg-neutral-800 text-primary-600 dark:text-primary-400 font-semibold'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            Available Shuttles
          </button>
          <button
            onClick={() => setCurrentView('extra-trips')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              currentView === 'extra-trips'
                ? 'bg-neutral-100 dark:bg-neutral-800 text-primary-600 dark:text-primary-400 font-semibold'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            Special / Extra Trips
          </button>
          {user && (
            <button
              onClick={() => setCurrentView('my-bookings')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                currentView === 'my-bookings'
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-primary-600 dark:text-primary-400 font-semibold'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900'
              }`}
            >
              My Bookings
            </button>
          )}
          <button
            onClick={() => setCurrentView('feedback')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              currentView === 'feedback'
                ? 'bg-neutral-100 dark:bg-neutral-800 text-primary-600 dark:text-primary-400 font-semibold'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            Reviews & Feedback
          </button>

          {/* Manager Exclusive Tab */}
          {user?.role === 'MANAGER' && (
            <button
              onClick={() => setCurrentView('manager-portal')}
              className={`px-3 py-1.5 rounded-md font-semibold text-xs uppercase tracking-wide transition-colors ${
                currentView === 'manager-portal'
                  ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50'
              }`}
            >
              Manager Portal
            </button>
          )}
        </nav>

        {/* Right Section: Theme Toggle & Auth State */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Toggle Dark Mode"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-600" />}
          </button>

          {user ? (
            <div className="flex items-center space-x-2">
              {/* Affiliation verification badge */}
              {user.role !== 'MANAGER' && (
                <div
                  className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.verificationStatus === 'VERIFIED'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      : user.verificationStatus === 'PENDING'
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                  }`}
                  title={`Affiliation status: ${user.verificationStatus}`}
                >
                  {user.verificationStatus === 'VERIFIED' && <CheckCircle className="w-3 h-3" />}
                  {user.verificationStatus === 'PENDING' && <Clock className="w-3 h-3" />}
                  {user.verificationStatus === 'REJECTED' && <ShieldAlert className="w-3 h-3" />}
                  <span>{user.verificationStatus}</span>
                </div>
              )}

              <button
                onClick={() => setCurrentView('dashboard')}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-xs text-neutral-800 dark:text-neutral-200 transition-colors"
              >
                <UserIcon className="w-3.5 h-3.5 text-primary-600" />
                <span className="font-medium max-w-[120px] truncate">{user.fullName.split(' ')[0]}</span>
              </button>

              <button
                onClick={() => logout()}
                className="p-2 rounded-lg text-neutral-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Sign Out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentView('login')}
                className="px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:text-primary-600 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => setCurrentView('register')}
                className="px-3 py-1.5 text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors shadow-sm"
              >
                Register
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

