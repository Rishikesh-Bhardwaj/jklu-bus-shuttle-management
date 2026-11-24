import React, { useState } from 'react';
import {
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const handleNavClick = (view: string) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
  };

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'trips', label: 'Available Shuttles' },
    { id: 'extra-trips', label: 'Special / Extra' },
    ...(user ? [{ id: 'my-bookings', label: 'My Passes' }] : []),
    { id: 'feedback', label: 'Reviews & Feedback' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[#e6dfd5] dark:border-[#232d42] bg-[#faf7f1]/85 dark:bg-[#0b0f17]/85 backdrop-blur-xl transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Brand Lockup with Campus Market Logo Tile */}
        <div
          className="flex items-center gap-3 cursor-pointer select-none group"
          onClick={() => handleNavClick('home')}
        >
          <div className="w-10 h-10 rounded-xl bg-white shadow-xs border border-[#e6dfd5] dark:border-neutral-700/80 p-1 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105">
            <img
              src="/images/jklu-logo.png"
              alt="JKLU Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 leading-none">
              <span className="font-bold text-base tracking-tight text-neutral-900 dark:text-neutral-100">
                Campus Shuttle
              </span>
              <Badge variant="primary" size="sm" className="hidden lg:inline-flex text-[10px] py-0 font-bold uppercase tracking-wider">
                Transit
              </Badge>
            </div>
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 leading-none mt-1 hidden sm:block">
              JK Lakshmipat University
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1">
          {navLinks.map((link) => {
            const isActive = currentView === link.id;
            return (
              <button
                key={link.id}
                onClick={() => handleNavClick(link.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-neutral-200/70 dark:bg-neutral-800/80 text-neutral-900 dark:text-neutral-100 font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200/40 dark:hover:bg-neutral-800/40'
                }`}
              >
                {link.label}
              </button>
            );
          })}

          {/* Manager Portal Tab */}
          {user?.role === 'MANAGER' && (
            <button
              onClick={() => handleNavClick('manager-portal')}
              className={`ml-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 flex items-center gap-1.5 ${
                currentView === 'manager-portal'
                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-warm-sm'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 hover:bg-amber-100'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Manager Portal</span>
            </button>
          )}
        </nav>

        {/* Right Section: Pill-Style Theme Toggle, Profile & Auth */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Pill-Style Theme Toggle matching Campus Market */}
          <button
            type="button"
            role="switch"
            aria-checked={darkMode}
            onClick={() => setDarkMode(!darkMode)}
            className="relative inline-flex items-center h-8 px-1 py-0.5 rounded-full bg-[#f2ede4] dark:bg-[#1a2233] border border-[#e6dfd5] dark:border-[#232d42] transition-colors focus-ring select-none text-xs font-medium cursor-pointer"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all duration-200 ${
                !darkMode
                  ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Light</span>
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all duration-200 ${
                darkMode
                  ? 'bg-[#121826] text-neutral-100 shadow-xs font-semibold border border-[#232d42]'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Dark</span>
            </span>
          </button>

          {user ? (
            <div className="flex items-center space-x-2">
              {/* Affiliation verification badge (Students/Faculty) */}
              {user.role !== 'MANAGER' && (
                <div className="hidden lg:block">
                  {user.verificationStatus === 'VERIFIED' && (
                    <Badge variant="success" dot size="sm">Verified</Badge>
                  )}
                  {user.verificationStatus === 'PENDING' && (
                    <Badge variant="warning" dot size="sm">Pending</Badge>
                  )}
                  {user.verificationStatus === 'REJECTED' && (
                    <Badge variant="danger" dot size="sm">Action Req</Badge>
                  )}
                </div>
              )}

              {/* User profile button */}
              <button
                onClick={() => handleNavClick('dashboard')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all shadow-warm-sm ${
                  currentView === 'dashboard'
                    ? 'bg-primary-50 dark:bg-primary-950/70 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800'
                    : 'bg-white dark:bg-[#121826] border-[#e6dfd5] dark:border-[#232d42] hover:bg-[#f2ede4] dark:hover:bg-[#1a2233] text-neutral-800 dark:text-neutral-200'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-[10px]">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="max-w-[100px] sm:max-w-[120px] truncate">
                  {user.fullName.split(' ')[0]}
                </span>
              </button>

              {/* Sign out */}
              <button
                onClick={() => logout()}
                className="p-2 rounded-lg text-neutral-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors focus-ring"
                title="Sign Out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleNavClick('login')}
              >
                Sign In
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleNavClick('register')}
              >
                Register
              </Button>
            </div>
          )}

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-[#f2ede4] dark:hover:bg-[#1a2233] transition-colors focus-ring"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer / Sheet */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#e6dfd5] dark:border-[#232d42] bg-[#faf7f1] dark:bg-[#0b0f17] px-4 pt-3 pb-5 space-y-2 animate-in slide-in-from-top-2 duration-150 shadow-warm">
          <div className="space-y-1">
            {navLinks.map((link) => {
              const isActive = currentView === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleNavClick(link.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                    isActive
                      ? 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold border border-[#e6dfd5] dark:border-[#232d42]'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-[#f2ede4] dark:hover:bg-[#1a2233]'
                  }`}
                >
                  <span>{link.label}</span>
                </button>
              );
            })}

            {user?.role === 'MANAGER' && (
              <button
                onClick={() => handleNavClick('manager-portal')}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${
                  currentView === 'manager-portal'
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                  <span>Manager Portal</span>
                </span>
                <Badge variant="warning" size="sm">MANAGER</Badge>
              </button>
            )}
          </div>

          {user && (
            <div className="pt-3 border-t border-[#e6dfd5] dark:border-[#232d42] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-xs">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="leading-tight">
                  <span className="font-bold block text-neutral-900 dark:text-neutral-100">{user.fullName}</span>
                  <span className="text-[11px] text-neutral-500">{user.email}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => logout()}>
                Sign Out
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

