import React, { useState } from 'react';
import { Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginViewProps {
  setCurrentView: (view: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ setCurrentView }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide your university email and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login(email.trim(), password);
      setCurrentView('dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-8 space-y-6">
        <div className="text-center space-y-2">
          <img
            src="/images/jklu-logo.png"
            alt="JK Lakshmipat University"
            className="h-12 w-auto object-contain mx-auto mb-2"
          />
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Sign In to JKLU Shuttle
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Access seat bookings, digital boarding passes, and schedules
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-neutral-700 dark:text-neutral-300">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-neutral-700 dark:text-neutral-300">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Sign In</span>
          </button>
        </form>

        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 text-center text-xs text-neutral-500">
          <span>Don't have an account yet? </span>
          <button
            onClick={() => setCurrentView('register')}
            className="font-semibold text-primary-600 hover:text-primary-700"
          >
            Register Affiliation
          </button>
        </div>
      </div>
    </div>
  );
};
