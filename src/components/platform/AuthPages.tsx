'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Mail, Lock, AlertCircle, Loader2, CheckCircle, Gift, RefreshCw, Globe, KeyRound, Shield, BarChart3, Headphones, Clock, ShieldCheck, ClipboardPaste, ClipboardCopy } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';

export default function AuthPages() {
  const { currentPage, setCurrentPage, setUser } = useAppStore();
  const { t, lang, toggleLang, isRTL, dir } = useI18n();
  const isLogin = currentPage === 'login';
  const [showForgot, setShowForgot] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [showReset, setShowReset] = useState(false);

  // Check for reset token in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset');
    if (token) {
      setResetToken(token);
      setShowReset(true);
      setCurrentPage('login');
    }
  }, []);

  // Prevent hydration flash - only render after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) {
    // Show a dark background matching the app theme instead of blank/null
    // This prevents the white flash during hydration
    return (
      <div className="min-h-screen bg-[#030708]" style={{ fontFamily: "'Cairo', sans-serif" }} />
    );
  }

  // Show reset password form
  if (showReset) {
    return (
      <div className="min-h-screen bg-[#030708] flex items-center justify-center relative overflow-hidden">
        <button
          onClick={toggleLang}
          className="fixed top-4 left-4 z-50 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-[#409eff] hover:bg-[#409eff]/5 hover:border-[#409eff]/20 transition-all"
        >
          <Globe size={14} />
          <span className="text-xs font-bold">{lang === 'ar' ? 'English' : 'عربي'}</span>
        </button>
        <div className="absolute inset-0 animated-grid" />
        <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-[#409eff]/[0.03] blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[#409eff]/[0.04] blur-[100px]" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 w-full max-w-md mx-4"
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-3 mb-4"
            >
              <img src="/logo-premium.png" alt={t('common.appName')} className="w-12 h-12 rounded-xl object-cover" />
              <span className="gold-shimmer text-2xl font-bold">{t('common.appName')}</span>
            </motion.div>
            <p className="text-white/50 text-sm">{t('auth.resetPassword')}</p>
          </div>
          <ResetPasswordForm
            token={resetToken}
            onSuccess={() => { setShowReset(false); setResetToken(''); }}
          />
          <button
            onClick={() => { setShowReset(false); setResetToken(''); setCurrentPage('login'); }}
            className="mt-6 flex items-center justify-center gap-2 text-white/40 hover:text-[#409eff] text-sm transition-colors mx-auto"
          >
            <ArrowRight size={16} />
            {t('auth.backToLogin')}
          </button>
        </motion.div>
      </div>
    );
  }

  // Show forgot password form
  if (showForgot) {
    return (
      <div className="min-h-screen bg-[#030708] flex items-center justify-center relative overflow-hidden">
        <button
          onClick={toggleLang}
          className="fixed top-4 left-4 z-50 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-[#409eff] hover:bg-[#409eff]/5 hover:border-[#409eff]/20 transition-all"
        >
          <Globe size={14} />
          <span className="text-xs font-bold">{lang === 'ar' ? 'English' : 'عربي'}</span>
        </button>
        <div className="absolute inset-0 animated-grid" />
        <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-[#409eff]/[0.03] blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[#409eff]/[0.04] blur-[100px]" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 w-full max-w-md mx-4"
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-3 mb-4"
            >
              <img src="/logo-premium.png" alt={t('common.appName')} className="w-12 h-12 rounded-xl object-cover" />
              <span className="gold-shimmer text-2xl font-bold">{t('common.appName')}</span>
            </motion.div>
            <p className="text-white/50 text-sm">{t('auth.forgotPassword')}</p>
          </div>
          <ForgotPasswordForm
            onSuccess={() => setShowForgot(false)}
          />
          <button
            onClick={() => { setShowForgot(false); setCurrentPage('login'); }}
            className="mt-6 flex items-center justify-center gap-2 text-white/40 hover:text-[#409eff] text-sm transition-colors mx-auto"
          >
            <ArrowRight size={16} />
            {t('auth.backToLogin')}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030708] flex items-center justify-center relative overflow-hidden">
      {/* Language Toggle - Top Right */}
      <button
        onClick={toggleLang}
        className="fixed top-4 left-4 z-50 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-[#409eff] hover:bg-[#409eff]/5 hover:border-[#409eff]/20 transition-all"
        title={lang === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
      >
        <Globe size={14} />
        <span className="text-xs font-bold">{lang === 'ar' ? 'English' : 'عربي'}</span>
      </button>
      {/* Background effects */}
      <div className="absolute inset-0 animated-grid" />
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-[#409eff]/[0.03] blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[#409eff]/[0.04] blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-3 mb-4 cursor-pointer"
            onClick={() => setCurrentPage('landing')}
          >
            <img src="/logo-premium.png" alt={t('common.appName')} className="w-12 h-12 rounded-xl object-cover" />
            <span className="gold-shimmer text-2xl font-bold">{t('common.appName')}</span>
          </motion.div>
          <p className="text-white/50 text-sm">
            {isLogin ? t('auth.loginWelcome') : t('auth.registerWelcome')}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl glass-gold p-8">
          <AnimatePresence mode="popLayout" initial={false}>
            {isLogin ? (
              <LoginForm key="login" onForgotPassword={() => setShowForgot(true)} />
            ) : (
              <RegisterForm key="register" />
            )}
          </AnimatePresence>

          {/* Switch */}
          <div className="mt-6 text-center">
            <span className="text-white/40 text-sm">
              {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
            </span>
            <button
              onClick={() => setCurrentPage(isLogin ? 'register' : 'login')}
              className="text-[#409eff] font-medium text-sm hover:underline mr-2"
            >
              {isLogin ? t('auth.registerNow') : t('auth.loginNow')}
            </button>
          </div>
        </div>

        {/* Back button */}
        <button
          onClick={() => setCurrentPage('landing')}
          className="mt-6 flex items-center justify-center gap-2 text-white/40 hover:text-[#409eff] text-sm transition-colors mx-auto"
        >
          <ArrowRight size={16} />
          {t('auth.backToHome')}
        </button>
      </motion.div>
    </div>
  );
}

function LoginForm({ onForgotPassword }: { onForgotPassword: () => void }) {
  const { setUser, setCurrentPage, refreshUser } = useAppStore();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needVerification, setNeedVerification] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown > 0) {
      countdownRef.current = setTimeout(() => {
        setResendCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearTimeout(countdownRef.current);
    };
  }, [resendCountdown]);

  // Start countdown when verification step is shown
  useEffect(() => {
    if (needVerification) {
      setResendCountdown(60);
    }
  }, [needVerification]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(t('auth.fillAllFields'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.needVerification) {
          setVerifyEmail(email);
          setNeedVerification(true);
          setLoading(false);
          return;
        }
        setError(data.error || t('auth.loginError'));
        return;
      }

      setUser(data.user, data.token);

      // Calculate profits after login
      try {
        await fetch('/api/profits/calculate', { method: 'POST' });
      } catch {
        // ignore
      }

      await refreshUser();
      setCurrentPage('dashboard');
    } catch {
      setError(t('common.serverError'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    const code = otp.join('');

    if (code.length !== 6) {
      setVerifyError(t('auth.fillAllFields'));
      return;
    }

    setVerifying(true);
    setVerifyError('');
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyEmail, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setVerifyError(data.error || t('auth.verifyError'));
        return;
      }

      // Auto login after verification
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyEmail, password }),
      });
      const loginData = await loginRes.json();

      if (loginRes.ok && loginData.user) {
        setUser(loginData.user, loginData.token);
        await refreshUser();
        setCurrentPage('dashboard');
      } else {
        setNeedVerification(false);
        setCurrentPage('login');
      }
    } catch {
      setVerifyError(t('common.serverError'));
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCountdown > 0 || resendLoading) return;

    setResendLoading(true);
    setVerifyError('');
    try {
      const res = await fetch('/api/auth/send-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        setVerifyError(data.error || t('auth.verifyError'));
        return;
      }

      // Reset OTP inputs and start countdown
      setOtp(Array(6).fill(''));
      setResendCountdown(60);
    } catch {
      setVerifyError(t('common.serverError'));
    } finally {
      setResendLoading(false);
    }
  };

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    if (otp.every(d => d !== '') && otp.length === 6) {
      handleVerifyEmail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);
  if (needVerification) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* Header with SONA branding */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center space-y-3"
        >
          <div className="inline-flex items-center gap-3 mb-2">
            <img src="/sona-icon.png" alt="SONA" className="w-10 h-10 rounded-xl object-contain" style={{filter:"drop-shadow(0 2px 10px rgba(64,158,255,0.3))"}} />
            <span className="text-2xl font-bold bg-gradient-to-l from-[#3B82F6] to-[#14B8A6] bg-clip-text text-transparent">SONA</span>
          </div>
          <p className="text-white/40 text-xs">{t('auth.tradingPlatform')}</p>
        </motion.div>

        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-center space-y-2"
        >
          <h2 className="text-2xl font-bold text-white">{t('auth.hello')} 👋</h2>
          <p className="text-white/50 text-sm leading-relaxed">
            {t('auth.enterOtpDesc')}
          </p>
          <p className="text-blue-400 text-sm font-medium" dir="ltr">{verifyEmail}</p>
        </motion.div>

        {/* Security badge */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-center gap-1.5"
        >
          <ShieldCheck size={14} className="text-teal-400" />
          <span className="text-teal-400 text-xs font-medium">{t('auth.secure')}</span>
        </motion.div>

        {/* OTP Input */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <OTPInput value={otp} onChange={setOtp} disabled={verifying} />
        </motion.div>

        {verifyError && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={16} />
            {verifyError}
          </motion.div>
        )}

        {/* Timer & Resend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          {resendCountdown > 0 ? (
            <p className="text-white/40 text-sm flex items-center justify-center gap-2">
              <Clock size={14} className="text-white/30" />
              {t('auth.canResendAfter')} <span className="text-teal-400 font-bold">{resendCountdown}</span> {t('auth.seconds')}
            </p>
          ) : (
            <button
              onClick={handleResendCode}
              disabled={resendLoading}
              className="text-teal-400 text-sm font-medium hover:underline flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
            >
              {resendLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {t('auth.resendCode')}
            </button>
          )}
        </motion.div>

        {/* Confirm button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <button
            onClick={handleVerifyEmail}
            disabled={verifying || otp.some(d => !d)}
            className="w-full py-3.5 rounded-xl bg-gradient-to-l from-[#3B82F6] to-[#14B8A6] text-white font-bold text-lg hover:shadow-lg hover:shadow-blue-500/20 transition-all btn-shine disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {verifying ? <Loader2 size={20} className="animate-spin" /> : <><span>{t('auth.confirmCode')}</span><ArrowRight size={20} /></>}
          </button>
        </motion.div>

        {/* Back to login button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <button
            onClick={() => { setNeedVerification(false); setOtp(Array(6).fill('')); setVerifyError(''); }}
            className="flex items-center justify-center gap-2 text-white/40 hover:text-white/60 text-sm mx-auto transition-colors"
          >
            <ArrowRight size={16} className="rotate-180" />
            {t('auth.backToLogin')}
          </button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -5 }}
      transition={{ duration: 0.15 }}
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <h2 className="text-2xl font-bold text-white text-center mb-2">{t('auth.login')}</h2>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </motion.div>
      )}

      <div className="relative">
        <Mail size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.email')}
          className="w-full pr-12 pl-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[#409eff]/50 focus:outline-none transition-colors"
          dir="ltr"
        />
      </div>

      <div className="relative">
        <Lock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.password')}
          className="w-full pr-12 pl-12 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[#409eff]/50 focus:outline-none transition-colors"
          dir="ltr"
        />
        <button type="button" onClick={() => setShowPassword(!showPassword)}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50 transition-colors">
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-[#409eff] text-sm hover:underline"
        >
          {t('auth.forgotPassword')}
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        onDoubleClick={(e) => e.preventDefault()}
        className="w-full py-3.5 rounded-xl bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white font-bold text-lg hover:shadow-lg hover:shadow-[#409eff]/20 transition-all btn-shine disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 select-none"
      >
        {loading ? <Loader2 size={20} className="animate-spin" /> : t('auth.login')}
      </button>
    </motion.form>
  );
}

function OTPInput({ value, onChange, disabled }: { value: string[]; onChange: (val: string[]) => void; disabled: boolean }) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const length = 6;

  const setRef = useCallback((index: number) => (el: HTMLInputElement | null) => {
    inputRefs.current[index] = el;
  }, []);

  // Auto-focus first input on mount
  useEffect(() => {
    if (!disabled) {
      inputRefs.current[0]?.focus();
    }
  }, [disabled]);

  const focusInput = useCallback((index: number) => {
    if (index >= 0 && index < length) {
      inputRefs.current[index]?.focus();
    }
  }, [length]);

  const handleChange = useCallback((index: number, digit: string) => {
    // Only accept digits
    if (digit && !/^\d$/.test(digit)) return;

    const newValue = [...value];
    newValue[index] = digit;
    onChange(newValue);

    // Auto-advance to next input
    if (digit && index < length - 1) {
      focusInput(index + 1);
    }
  }, [value, onChange, focusInput, length]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!value[index] && index > 0) {
        // If current input is empty, move back and clear
        const newValue = [...value];
        newValue[index - 1] = '';
        onChange(newValue);
        focusInput(index - 1);
      } else {
        // Clear current input
        const newValue = [...value];
        newValue[index] = '';
        onChange(newValue);
      }
    } else if (e.key === 'ArrowLeft') {
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight') {
      focusInput(index + 1);
    }
  }, [value, onChange, focusInput]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    const digits = pastedData.replace(/\D/g, '').slice(0, length).split('');

    if (digits.length > 0) {
      const newValue = [...value];
      digits.forEach((digit, i) => {
        newValue[i] = digit;
      });
      onChange(newValue);

      // Focus the next empty input or the last one
      const nextEmpty = newValue.findIndex(v => !v);
      focusInput(nextEmpty === -1 ? length - 1 : nextEmpty);
    }
  }, [value, onChange, focusInput, length]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  // Paste from clipboard button (for mobile users who can't easily long-press)
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const digits = text.trim().replace(/\D/g, '').slice(0, length).split('');
      if (digits.length > 0) {
        const newValue = [...value];
        digits.forEach((digit, i) => {
          newValue[i] = digit;
        });
        onChange(newValue);
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 2000);
      }
    } catch {
      // Clipboard API might not be available or permission denied
      // Fallback: focus the first input so user can paste manually
      inputRefs.current[0]?.focus();
    }
  }, [value, onChange, length]);

  // Copy current OTP value to clipboard
  const [copySuccess, setCopySuccess] = useState(false);
  const handleCopyCode = useCallback(async () => {
    const code = value.join('');
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch { /* ignore */ }
    }
  }, [value]);

  return (
    <div className="space-y-3">
      <div className="flex justify-center gap-2 sm:gap-3" dir="ltr">
        {Array.from({ length }, (_, i) => (
          <input
            key={i}
            ref={setRef(i)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[i] || ''}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={handleFocus}
            disabled={disabled}
            className="w-12 h-14 rounded-xl bg-white/5 border border-blue-500/30 text-blue-400 text-2xl font-bold text-center focus:border-blue-500 focus:outline-none focus:shadow-[0_0_12px_rgba(59,130,246,0.2)] transition-all disabled:opacity-50"
            autoComplete="one-time-code"
          />
        ))}
      </div>
      {/* Action buttons: Paste & Copy */}
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={handlePasteFromClipboard}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
            pasteSuccess
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/60 hover:bg-white/10 hover:border-white/20'
          }`}
        >
          {pasteSuccess ? (
            <>
              <CheckCircle size={13} />
              <span>تم اللصق!</span>
            </>
          ) : (
            <>
              <ClipboardPaste size={13} />
              <span>لصق الرمز</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleCopyCode}
          disabled={disabled || value.every(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30 ${
            copySuccess
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/60 hover:bg-white/10 hover:border-white/20'
          }`}
        >
          {copySuccess ? (
            <>
              <CheckCircle size={13} />
              <span>تم النسخ!</span>
            </>
          ) : (
            <>
              <ClipboardCopy size={13} />
              <span>نسخ الرمز</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function RegisterForm() {
  const { setUser, setCurrentPage, refreshUser } = useAppStore();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const submitLockRef = useRef(false);
  const [showVerification, setShowVerification] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [verifying, setVerifying] = useState(false);

  // OTP state
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Read referral code from URL query parameter on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get('ref');
      if (refCode) {
        setReferralCode(refCode.toUpperCase());
      }
    } catch {
      // URLSearchParams not available
    }
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown > 0) {
      countdownRef.current = setTimeout(() => {
        setResendCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearTimeout(countdownRef.current);
    };
  }, [resendCountdown]);

  // Start countdown when verification step is shown
  useEffect(() => {
    if (showVerification) {
      setResendCountdown(60);
    }
  }, [showVerification]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent double submission using REF (synchronous) + STATE (for UI)
    if (submitLockRef.current || submitLocked) return;
    submitLockRef.current = true;
    setSubmitLocked(true);

    setError('');

    if (!email || !password) {
      setError(t('auth.fillAllRequired'));
      submitLockRef.current = false;
      setSubmitLocked(false);
      return;
    }

    if (password.length < 8) {
      setError(t('auth.passwordMinLength'));
      submitLockRef.current = false;
      setSubmitLocked(false);
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      submitLockRef.current = false;
      setSubmitLocked(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, referralCode: referralCode || undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('auth.registerError'));
        submitLockRef.current = false;
        setSubmitLocked(false);
        setLoading(false);
        return;
      }

      // Show verification step
      setRegisteredEmail(email);
      setShowVerification(true);
    } catch {
      setError(t('common.serverError'));
      submitLockRef.current = false;
      setSubmitLocked(false);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    const code = otp.join('');

    if (code.length !== 6) {
      setVerifyError(t('auth.fillAllFields'));
      return;
    }

    setVerifying(true);
    setVerifyError('');
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registeredEmail, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setVerifyError(data.error || t('auth.verifyError'));
        return;
      }

      // Auto login after verification
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registeredEmail, password }),
      });
      const loginData = await loginRes.json();

      if (loginRes.ok && loginData.user) {
        setUser(loginData.user, loginData.token);
        await refreshUser();
        setCurrentPage('dashboard');
      } else {
        setCurrentPage('login');
      }
    } catch {
      setVerifyError(t('common.serverError'));
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCountdown > 0 || resendLoading) return;

    setResendLoading(true);
    setVerifyError('');
    try {
      const res = await fetch('/api/auth/send-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registeredEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        setVerifyError(data.error || t('auth.verifyError'));
        return;
      }

      // Reset OTP inputs and start countdown
      setOtp(Array(6).fill(''));
      setResendCountdown(60);
    } catch {
      setVerifyError(t('common.serverError'));
    } finally {
      setResendLoading(false);
    }
  };

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    if (otp.every(d => d !== '') && otp.length === 6) {
      handleVerifyEmail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]); // Only trigger on otp change

  // Verification step
  if (showVerification) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* Header with SONA branding */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center space-y-3"
        >
          <div className="inline-flex items-center gap-3 mb-2">
            <img src="/sona-icon.png" alt="SONA" className="w-10 h-10 rounded-xl object-contain" style={{filter:"drop-shadow(0 2px 10px rgba(64,158,255,0.3))"}} />
            <span className="text-2xl font-bold bg-gradient-to-l from-[#3B82F6] to-[#14B8A6] bg-clip-text text-transparent">SONA</span>
          </div>
          <p className="text-white/40 text-xs">{t('auth.tradingPlatform')}</p>
        </motion.div>

        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-center space-y-2"
        >
          <h2 className="text-2xl font-bold text-white">{t('auth.hello')} 👋</h2>
          <p className="text-white/50 text-sm leading-relaxed">
            {t('auth.enterOtpDesc')}
          </p>
          <p className="text-blue-400 text-sm font-medium" dir="ltr">{registeredEmail}</p>
        </motion.div>

        {/* Security badge */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-center gap-1.5"
        >
          <ShieldCheck size={14} className="text-teal-400" />
          <span className="text-teal-400 text-xs font-medium">{t('auth.secure')}</span>
        </motion.div>

        {/* OTP Input */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <OTPInput value={otp} onChange={setOtp} disabled={verifying} />
        </motion.div>

        {verifyError && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={16} />
            {verifyError}
          </motion.div>
        )}

        {/* Timer & Resend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          {resendCountdown > 0 ? (
            <p className="text-white/40 text-sm flex items-center justify-center gap-2">
              <Clock size={14} className="text-white/30" />
              {t('auth.canResendAfter')} <span className="text-teal-400 font-bold">{resendCountdown}</span> {t('auth.seconds')}
            </p>
          ) : (
            <button
              onClick={handleResendCode}
              disabled={resendLoading}
              className="text-teal-400 text-sm font-medium hover:underline flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
            >
              {resendLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {t('auth.resendCode')}
            </button>
          )}
        </motion.div>

        {/* Confirm button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <button
            onClick={handleVerifyEmail}
            disabled={verifying || otp.some(d => !d)}
            className="w-full py-3.5 rounded-xl bg-gradient-to-l from-[#3B82F6] to-[#14B8A6] text-white font-bold text-lg hover:shadow-lg hover:shadow-blue-500/20 transition-all btn-shine disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {verifying ? <Loader2 size={20} className="animate-spin" /> : <><span>{t('auth.confirmCode')}</span><ArrowRight size={20} /></>}
          </button>
        </motion.div>

        {/* Info cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="space-y-3"
        >
          <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Shield size={16} className="text-blue-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">{t('auth.highSecurity')}</p>
              <p className="text-white/40 text-xs mt-0.5">{t('auth.highSecurityDesc')}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <BarChart3 size={16} className="text-teal-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">{t('auth.professionalAnalytics')}</p>
              <p className="text-white/40 text-xs mt-0.5">{t('auth.professionalAnalyticsDesc')}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Headphones size={16} className="text-blue-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">{t('auth.support247Short')}</p>
              <p className="text-white/40 text-xs mt-0.5">{t('auth.support247Desc')}</p>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="text-white/20 text-xs text-center"
        >
          {t('auth.allRightsReserved')} SONA. © 2026
        </motion.p>
      </motion.div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 5 }}
      transition={{ duration: 0.15 }}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <h2 className="text-2xl font-bold text-white text-center mb-2">{t('auth.register')}</h2>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </motion.div>
      )}

      <div className="relative">
        <Mail size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.emailRequired')}
          className="w-full pr-12 pl-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[#409eff]/50 focus:outline-none transition-colors"
          dir="ltr"
        />
      </div>

      <div className="relative">
        <Lock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.passwordRequired')}
          className="w-full pr-12 pl-12 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[#409eff]/50 focus:outline-none transition-colors"
          dir="ltr"
        />
        <button type="button" onClick={() => setShowPassword(!showPassword)}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50 transition-colors">
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      <div className="relative">
        <Lock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t('auth.confirmPassword')}
          className="w-full pr-12 pl-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[#409eff]/50 focus:outline-none transition-colors"
          dir="ltr"
        />
      </div>

      {/* Referral Code */}
      <div className="relative">
        <Gift size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          placeholder={t('auth.referralCode')}
          className="w-full pr-12 pl-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[#409eff]/50 focus:outline-none transition-colors"
          dir="ltr"
          maxLength={8}
        />
      </div>

      {referralCode && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="flex items-center gap-2 p-3 rounded-lg bg-[#409eff]/10 border border-[#409eff]/20 text-[#409eff] text-sm">
          <Gift size={16} />
          {t('auth.referralBonus')}
        </motion.div>
      )}

      <button
        type="submit"
        disabled={loading || submitLocked}
        onDoubleClick={(e) => e.preventDefault()}
        className="w-full py-3.5 rounded-xl bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white font-bold text-lg hover:shadow-lg hover:shadow-[#409eff]/20 transition-all btn-shine disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 size={20} className="animate-spin" /> : t('auth.createAccount')}
      </button>
    </motion.form>
  );
}

function ForgotPasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const { setCurrentPage } = useAppStore();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const submitLockRef = useRef(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent double submission using REF (synchronous) + STATE (for UI)
    if (submitLockRef.current || submitLocked) return;
    submitLockRef.current = true;
    setSubmitLocked(true);

    setError('');

    if (!email) {
      setError(t('auth.pleaseEnterEmail'));
      submitLockRef.current = false;
      setSubmitLocked(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'forgot-password', email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('common.error'));
        submitLockRef.current = false;
        setSubmitLocked(false);
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError(t('common.connectionError'));
      submitLockRef.current = false;
      setSubmitLocked(false);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="text-center space-y-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-green-500/10"
        >
          <Mail size={36} className="text-green-400" />
        </motion.div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {t('auth.linkSentTitle')}
          </h2>
          <p className="text-white/50 text-sm leading-relaxed">
            {t('auth.resetLinkSentDesc')}
          </p>
          <p className="text-[#409eff] text-sm font-medium mt-1" dir="ltr">{email}</p>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
          <div className="flex items-center gap-2 text-white/40 text-xs">
            <CheckCircle size={12} className="text-[#409eff]" />
            {t('auth.checkInbox')}
          </div>
        </div>

        <button
          onClick={() => { onSuccess(); setCurrentPage('login'); }}
          className="w-full py-3.5 rounded-xl bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white font-bold text-lg hover:shadow-lg hover:shadow-[#409eff]/20 transition-all btn-shine flex items-center justify-center gap-2"
        >
          {t('auth.backToLogin')}
        </button>
      </motion.div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit}
      className="rounded-2xl glass-gold p-8 space-y-5"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="flex justify-center mb-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-[#409eff]/10 flex items-center justify-center">
          <KeyRound size={32} className="text-[#409eff]" />
        </div>
      </motion.div>

      <h2 className="text-2xl font-bold text-white text-center mb-2">
        {t('auth.forgotPassword')}
      </h2>
      <p className="text-white/50 text-sm text-center">
        {t('auth.enterEmailForReset')}
      </p>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </motion.div>
      )}

      <div className="relative">
        <Mail size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.email')}
          className="w-full pr-12 pl-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[#409eff]/50 focus:outline-none transition-colors"
          dir="ltr"
        />
      </div>

      <button
        type="submit"
        disabled={loading || submitLocked}
        onDoubleClick={(e) => e.preventDefault()}
        className="w-full py-3.5 rounded-xl bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white font-bold text-lg hover:shadow-lg hover:shadow-[#409eff]/20 transition-all btn-shine disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 size={20} className="animate-spin" /> : <Mail size={20} />}
        {t('auth.sendResetLink')}
      </button>
    </motion.form>
  );
}

function ResetPasswordForm({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const { setCurrentPage } = useAppStore();
  const { t } = useI18n();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const submitLockRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    submitLockRef.current = true;

    setError('');

    if (!newPassword) {
      setError(t('auth.pleaseEnterNewPassword'));
      submitLockRef.current = false;
      return;
    }

    if (newPassword.length < 8) {
      setError(t('auth.passwordMinLength'));
      submitLockRef.current = false;
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      submitLockRef.current = false;
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password', token, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('common.error'));
        return;
      }

      setSuccess(true);
    } catch {
      setError(t('common.connectionError'));
      submitLockRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="text-center space-y-6 rounded-2xl glass-gold p-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-green-500/10"
        >
          <CheckCircle size={36} className="text-green-400" />
        </motion.div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {t('auth.changePassword')}
          </h2>
          <p className="text-white/50 text-sm leading-relaxed">
            {t('auth.passwordChangedSuccessDesc')}
          </p>
        </div>

        <button
          onClick={() => { onSuccess(); setCurrentPage('login'); }}
          className="w-full py-3.5 rounded-xl bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white font-bold text-lg hover:shadow-lg hover:shadow-[#409eff]/20 transition-all btn-shine flex items-center justify-center gap-2"
        >
          {t('auth.login')}
        </button>
      </motion.div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit}
      className="rounded-2xl glass-gold p-8 space-y-5"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="flex justify-center mb-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-[#409eff]/10 flex items-center justify-center">
          <Lock size={32} className="text-[#409eff]" />
        </div>
      </motion.div>

      <h2 className="text-2xl font-bold text-white text-center mb-2">
        {t('auth.resetPassword')}
      </h2>
      <p className="text-white/50 text-sm text-center">
        {t('auth.pleaseEnterNewPassword')}
      </p>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </motion.div>
      )}

      <div className="relative">
        <Lock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type={showPassword ? 'text' : 'password'}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t('auth.newPassword')}
          className="w-full pr-12 pl-12 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[#409eff]/50 focus:outline-none transition-colors"
          dir="ltr"
        />
        <button type="button" onClick={() => setShowPassword(!showPassword)}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50 transition-colors">
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      <div className="relative">
        <Lock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t('auth.confirmNewPassword')}
          className="w-full pr-12 pl-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[#409eff]/50 focus:outline-none transition-colors"
          dir="ltr"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        onDoubleClick={(e) => e.preventDefault()}
        className="w-full py-3.5 rounded-xl bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white font-bold text-lg hover:shadow-lg hover:shadow-[#409eff]/20 transition-all btn-shine disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 select-none"
      >
        {loading ? <Loader2 size={20} className="animate-spin" /> : <KeyRound size={20} />}
        {t('auth.changePassword')}
      </button>
    </motion.form>
  );
}
