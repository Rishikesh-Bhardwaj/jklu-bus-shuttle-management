import React from 'react';
import { Bus, MapPin } from 'lucide-react';
import { Badge } from './ui/Badge';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-line bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md text-neutral-600 dark:text-neutral-400 pt-10 pb-6 transition-colors shadow-warm-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-xs">
          {/* Brand & Mission */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2.5 text-neutral-900 dark:text-neutral-100 font-bold text-sm">
              <div className="p-1.5 bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 border border-primary-200/80 rounded-lg">
                <Bus className="w-4 h-4" />
              </div>
              <span className="tracking-tight">JKLU Campus Shuttle Services</span>
            </div>
            <p className="leading-relaxed text-neutral-600 dark:text-neutral-400">
              Safe, reliable, and scheduled transit connecting JK Lakshmipat University campus with Jaipur corridors for students, faculty, and administrative staff.
            </p>
            <div className="pt-1">
              <Badge variant="success" dot size="sm">
                Operational Database Connected & Verified
              </Badge>
            </div>
          </div>

          {/* Transport Desk Contact */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              Transport Desk & Campus Contact
            </h4>
            <ul className="space-y-2 text-neutral-600 dark:text-neutral-400">
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-primary-600 shrink-0 mt-0.5" />
                <span>Near Main Gate, JK Lakshmipat University, Near Mahindra SEZ, Ajmer Road, Jaipur - 302026</span>
              </li>
            </ul>
          </div>

          {/* Transport Policy & Standards */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              Service Policy & Commitments
            </h4>
            <p className="leading-relaxed text-neutral-600 dark:text-neutral-400">
              University affiliation verification is required for all seat bookings. Shuttle services operate according to published schedules for students and faculty.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="neutral" size="sm">Seat Reservation</Badge>
              <Badge variant="neutral" size="sm">Digital QR Passes</Badge>
              <Badge variant="neutral" size="sm">Zero Fare-Gating</Badge>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-line dark:border-line-dark flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-neutral-500">
          <p>© {new Date().getFullYear()} JK Lakshmipat University, Jaipur. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            <span>Official University Transport Management Portal</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

