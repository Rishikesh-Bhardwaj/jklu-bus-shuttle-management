import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest, fetchCsrfToken } from '../lib/api';

export interface User {
  userId: number;
  email: string;
  fullName: string;
  identificationNumber?: string | null;
  role: 'STUDENT' | 'FACULTY' | 'MANAGER';
  studentCategory: 'HOSTELLER' | 'DAY_SCHOLAR' | null;
  phoneNumber?: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  verificationNotes?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  reapplyVerification: (notes?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const res = await apiRequest<{ user: User }>('/auth/me');
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial bootstrap: prefetch CSRF token and verify existing session cookie
    fetchCsrfToken()
      .catch(() => {})
      .finally(() => {
        refreshUser();
      });
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await apiRequest<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(res.user);
    return res.user;
  };

  const register = async (data: any): Promise<void> => {
    await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  const logout = async (): Promise<void> => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  };

  const reapplyVerification = async (notes?: string): Promise<void> => {
    await apiRequest('/verification/reapply', {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
    await refreshUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
        reapplyVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

