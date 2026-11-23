import React from 'react';
import { Bus, MapPin, Phone, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-neutral-200/80 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md text-neutral-600 dark:text-neutral-400 py-8 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-xs">
        <div>
          <div className="flex items-center space-x-2 text-neutral-900 dark:text-neutral-100 font-bold text-sm mb-2">
            <Bus className="w-4 h-4 text-primary-600" />
            <span>JKLU Bus Shuttle Management System</span>
          </div>
          <p className="leading-relaxed">
            Dedicated campus shuttle transport services for students, faculty, and administrative staff at JK Lakshmipat University, Jaipur.
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Operational Database Connected & Verified</span>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider mb-2">
            Transport Desk & Campus Contact
          </h4>
          <ul className="space-y-1.5">
            <li className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span>Near Main Gate, JK Lakshmipat University, Near Mahindra SEZ, Ajmer Road, Jaipur - 302026</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span>Campus Helpline: +91 141 7107500 / Transport Desk Ext: 7522</span>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider mb-2">
            Service Policy & Architecture
          </h4>
          <p className="leading-relaxed mb-2">
            Affiliation verification is mandatory for boarding. Zero fake operational data. Dedicated university bus corridors with scheduled 6:00 PM return service guarantees.
          </p>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
            © {new Date().getFullYear()} JK Lakshmipat University. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

