import React, { useState } from 'react';
import { Lock, Mail, User, Phone, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface RegisterViewProps {
  setCurrentView: (view: string) => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({ setCurrentView }) => {
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    identificationNumber: '',
    email: '',
    password: '',
    role: 'STUDENT',
    studentCategory: 'DAY_SCHOLAR',
    phoneNumber: '',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const idLabel = formData.role === 'STUDENT' ? 'Roll Number' : 'Faculty ID';

    if (!formData.fullName.trim() || !formData.identificationNumber.trim() || !formData.email.trim() || !formData.password) {
      setError(`Full name, ${idLabel}, email address, and password are required.`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload: any = {
        fullName: formData.fullName.trim(),
        identificationNumber: formData.identificationNumber.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        phoneNumber: formData.phoneNumber.trim() || undefined,
      };

      if (formData.role === 'STUDENT') {
        payload.studentCategory = formData.studentCategory;
      }

      await register(payload);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-12 px-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-8 space-y-6">
        <div className="text-center space-y-2">
          <img
            src="/images/jklu-logo.png"
            alt="JK Lakshmipat University"
            className="h-12 w-auto object-contain mx-auto mb-2"
          />
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Register University Affiliation
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            For JKLU Students & Faculty. Manager accounts are setup by transport administration.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-center space-y-4">
            <div className="inline-flex p-3 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-base text-emerald-900 dark:text-emerald-100">
              Registration Successful!
            </h3>
            <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
              Your account has been registered with affiliation status <span className="font-semibold">PENDING</span>. You may now sign in. Once approved by the Transport Manager, you will be able to book shuttle seats.
            </p>
            <button
              onClick={() => setCurrentView('login')}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-sm"
            >
              Proceed to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Rahul Sharma"
                  required
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@example.com"
                  required
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Affiliation Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="STUDENT">Student</option>
                  <option value="FACULTY">Faculty Member</option>
                </select>
              </div>

              {formData.role === 'STUDENT' ? (
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Student Category
                  </label>
                  <select
                    value={formData.studentCategory}
                    onChange={(e) => setFormData({ ...formData, studentCategory: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="DAY_SCHOLAR">Day Scholar</option>
                    <option value="HOSTELLER">Hosteller</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Department / Designation
                  </label>
                  <div className="px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-neutral-500 text-[11px]">
                    University Teaching & Research Faculty
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Roll Number / Faculty ID Field */}
            <div className="space-y-1">
              <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                <span>{formData.role === 'STUDENT' ? 'Roll Number' : 'Faculty ID'}</span>
                <span className="text-[10px] text-primary-600 dark:text-primary-400 font-medium">Required for Verification</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.identificationNumber}
                  onChange={(e) => setFormData({ ...formData, identificationNumber: e.target.value })}
                  placeholder={formData.role === 'STUDENT' ? 'e.g. 2024BTECH001' : 'e.g. FAC202304'}
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-mono text-xs placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="+91 9876543210"
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
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
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
              <span>Submit Registration</span>
            </button>
          </form>
        )}

        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 text-center text-xs text-neutral-500">
          <span>Already registered? </span>
          <button
            onClick={() => setCurrentView('login')}
            className="font-semibold text-primary-600 hover:text-primary-700"
          >
            Sign In here
          </button>
        </div>
      </div>
    </div>
  );
};

