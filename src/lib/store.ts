'use client';

import { create } from 'zustand';

export type Lang = 'ar' | 'en';

export interface User {
  id: string;
  name: string;
  email: string;
  balance: number;
  totalProfit: number;
  totalDeposit: number;
  totalWithdraw: number;
  emailVerified: boolean;
  isActive: boolean;
  role: string;
  referralCode: string;
  referredBy: string | null;
  kycStatus: string;
  phone?: string;
  avatar?: string;
  withdrawableBalance: number;
}

export type PageName = 'landing' | 'login' | 'register' | 'dashboard' | 'packages' | 'deposit' | 'withdraw' | 'investments' | 'transactions' | 'profile' | 'referral' | 'signals' | 'verification' | 'notifications' | 'about' | 'wallet' | 'terms' | 'privacy' | 'support' | 'trading' | 'p2p' | 'admin' | 'admin_dashboard' | 'admin_users' | 'admin_transactions' | 'admin_investments' | 'admin_support' | 'admin_settings' | 'admin_activity_log' | 'admin_advanced' | 'admin_engineer';

interface AppState {
  currentPage: PageName;
  user: User | null;
  isAuthenticated: boolean;
  dashboardPage: PageName;
  token: string | null;
  lang: Lang;
  setCurrentPage: (page: PageName) => void;
  setUser: (user: User, token?: string) => void;
  setDashboardPage: (page: PageName) => void;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  getToken: () => string | null;
}

// ═══════════════════════════════════════════════════════════
// SECURITY: Base64-encoded local storage
// Uses stable encoding (not session-bound XOR) so that
// tokens survive page refreshes while still obfuscating
// data from casual inspection
// ═══════════════════════════════════════════════════════════

const STORAGE_PREFIX = '_s';

function obfuscate(data: string): string {
  try {
    return btoa(encodeURIComponent(data));
  } catch {
    return btoa(data);
  }
}

function deobfuscate(data: string): string {
  try {
    return decodeURIComponent(atob(data));
  } catch {
    try { return atob(data); } catch { return data; }
  }
}

function secureSet(key: string, value: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + btoa(key).slice(0, 8), obfuscate(value));
  } catch {}
}

function secureGet(key: string): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + btoa(key).slice(0, 8));
    if (!stored) return null;
    return deobfuscate(stored);
  } catch { return null; }
}

function secureRemove(key: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + btoa(key).slice(0, 8));
  } catch {}
}

function getInitialLang(): Lang {
  if (typeof window === 'undefined') return 'ar';
  try {
    const saved = secureGet('lang');
    if (saved === 'en' || saved === 'ar') return saved;
  } catch {}
  return 'ar';
}

// Strip sensitive fields before storing in localStorage
function sanitizeUserForStorage(user: any): User {
  return {
    id: user.id,
    name: user.name || '',
    email: user.email,
    balance: typeof user.balance === 'number' ? user.balance : 0,
    totalProfit: typeof user.totalProfit === 'number' ? user.totalProfit : 0,
    totalDeposit: user.totalDeposited ?? user.totalDeposit ?? 0,
    totalWithdraw: user.totalWithdrawn ?? user.totalWithdraw ?? 0,
    emailVerified: !!user.emailVerified,
    isActive: user.isActive !== false,
    role: user.role || 'USER',
    referralCode: user.referralCode || '',
    referredBy: user.referredByCode ?? user.referredBy ?? null,
    kycStatus: user.kycStatus || 'NONE',
    withdrawableBalance: typeof user.withdrawableBalance === 'number' ? user.withdrawableBalance : 0,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: 'landing',
  user: null,
  isAuthenticated: false,
  dashboardPage: 'dashboard',
  token: null,
  lang: getInitialLang(),

  setCurrentPage: (page) => set({ currentPage: page }),

  setUser: (user, token) => {
    if (token) {
      try {
        const safeUser = sanitizeUserForStorage(user);
        secureSet('token', token);
        secureSet('user', JSON.stringify(safeUser));
        // Also set httpOnly cookie-compatible header via API
      } catch {}
    }
    set({ user, isAuthenticated: true, token: token || null });
  },

  setDashboardPage: (page) => set({ dashboardPage: page }),

  setLang: (lang) => {
    try { secureSet('lang', lang); } catch {}
    set({ lang });
  },

  toggleLang: () => {
    const current = get().lang;
    const next: Lang = current === 'ar' ? 'en' : 'ar';
    try { secureSet('lang', next); } catch {}
    set({ lang: next });
  },

  logout: () => {
    try {
      secureRemove('token');
      secureRemove('user');
      secureRemove('lang');
      // Clean up legacy keys
      localStorage.removeItem('sona_token');
      localStorage.removeItem('sona_user');
      localStorage.removeItem('sona_lang');
      localStorage.removeItem('alpha_token');
      localStorage.removeItem('alpha_user');
    } catch {}
    set({ user: null, isAuthenticated: false, currentPage: 'landing', dashboardPage: 'dashboard', token: null });
  },

  getToken: () => {
    const { token } = get();
    if (token) return token;
    try {
      return secureGet('token') || localStorage.getItem('sona_token') || localStorage.getItem('alpha_token');
    } catch { return null; }
  },

  refreshUser: async () => {
    const { user } = get();
    if (!user) {
      // Try to load user from /api/auth (cookie-based) as primary fallback
      try {
        const authRes = await fetch('/api/auth');
        if (authRes.ok) {
          const authData = await authRes.json();
          if (authData.user) {
            const safeUser = sanitizeUserForStorage(authData.user);
            set({ user: safeUser, isAuthenticated: true });
            return;
          }
        }
      } catch {}

      // Secondary fallback: localStorage
      try {
        const savedUser = secureGet('user') || localStorage.getItem('sona_user');
        const savedToken = secureGet('token') || localStorage.getItem('sona_token');
        if (savedUser && savedToken) {
          let parsedUser = null;
          try {
            parsedUser = JSON.parse(savedUser);
          } catch {
            secureRemove('user');
            secureRemove('token');
            localStorage.removeItem('sona_user');
            localStorage.removeItem('sona_token');
            return;
          }
          if (parsedUser && parsedUser.id && parsedUser.email) {
            const safeUser = sanitizeUserForStorage(parsedUser);
            set({ user: safeUser, isAuthenticated: true, token: savedToken });
          } else {
            secureRemove('user');
            secureRemove('token');
            localStorage.removeItem('sona_user');
            localStorage.removeItem('sona_token');
          }
          return;
        }
      } catch {
        secureRemove('user');
        secureRemove('token');
      }
      return;
    }
    try {
      const token = get().getToken();
      const res = await fetch(`/api/user/${user.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const { password: _, verifyCode: _vc, verifyCodeExpiry: _ve, twoFactorSecret: _2fs, kycDocumentImage: _kdi, kycSelfieImage: _ksi, kycFrontImage: _kfi, kycBackImage: _kbi, kycVideoUrl: _kvu, kycAiResult: _kar, emailChangeCode: _ecc, ...rawUser } = data.user;
          const mappedUser = {
            ...rawUser,
            totalDeposit: rawUser.totalDeposited ?? rawUser.totalDeposit ?? 0,
            totalWithdraw: rawUser.totalWithdrawn ?? rawUser.totalWithdraw ?? 0,
            withdrawableBalance: rawUser.withdrawableBalance ?? 0,
          };
          try { secureSet('user', JSON.stringify(mappedUser)); } catch {}
          set({ user: mappedUser });
        }
      } else if (res.status === 401 || res.status === 403 || res.status === 404) {
        get().logout();
      }
    } catch {
      // Network error - don't logout
    }
  },
}));
