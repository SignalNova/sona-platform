'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Play,
  Menu,
  X,
  Shield,
  Award,
  Star,
  Zap,
  Gem,
  TrendingUp,
  Users,
  Clock,
  CheckCircle,
  ChevronUp,
  Mail,
  Bitcoin,
  Wallet,
  UserPlus,
  DollarSign,
  CircleDollarSign,
  Globe,
  Lock,
  ShieldCheck,
  Eye,
  Server,
  Activity,
  Headphones,
  ArrowUpRight,
  Quote,
  ExternalLink,
  Link2,
  Send,
  ChevronLeft,
  ChevronRight,
  Crown,
  Sparkles,
  BarChart3,
  Layers,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';
import { safeFixed } from '@/lib/utils';

/* ─── Package Interface ─── */
interface Pkg {
  id: string;
  name: string;
  nameEn: string;
  minAmount: number;
  maxAmount: number | null;
  dailyReturn: number;
  durationDays: number;
  description: string;
  color: string;
  icon: string;
}

const iconMap: Record<string, React.ReactNode> = {
  shield: <Shield size={28} />,
  award: <Award size={28} />,
  star: <Star size={28} />,
  zap: <Zap size={28} />,
  gem: <Gem size={28} />,
};

/* ─── Animated Counter Hook ─── */
function useCountUp(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!startOnView || !isInView) return;
    if (hasStarted.current) return;
    hasStarted.current = true;

    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end * 100) / 100);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, end, duration, startOnView]);

  return { count, ref };
}

/* ─── Section Wrapper ─── */
function Section({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`relative overflow-hidden ${className}`}>
      {children}
    </section>
  );
}

/* ═══════════════════════════════════════════
   1. NAVBAR
   ═══════════════════════════════════════════ */
function LandingNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { setCurrentPage } = useAppStore();
  const { lang, toggleLang, t } = useI18n();

  useEffect(() => {
    const h = () => setIsScrolled(window.scrollY > 30);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const scrollTo = useCallback((id: string) => {
    setIsMobileOpen(false);
    document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const links = [
    { label: t('landing.home'), href: '#hero' },
    { label: t('landing.packages'), href: '#packages' },
    { label: t('landing.aboutUs'), href: '#features' },
    { label: t('landing.securityLink'), href: '#security' },
    { label: t('landing.contactUs'), href: '#contact' },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-500 ${
        isScrolled
          ? 'bg-[#030708]/80 backdrop-blur-2xl border-b border-white/[0.06] shadow-lg shadow-black/20'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 sm:h-20">
          {/* Logo */}
          <a
            href="#hero"
            onClick={(e) => { e.preventDefault(); scrollTo('#hero'); }}
            className="flex items-center gap-3 group"
          >
            <div className="relative">
              <img src="/logo-premium.png" alt={t('common.appName')} className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover transition-transform duration-300 group-hover:scale-105" />
              <div className="absolute inset-0 rounded-lg bg-[#409eff]/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="flex flex-col">
              <span className="gold-shimmer text-xl sm:text-2xl font-bold leading-tight">{t('common.appName')}</span>
              <span className="text-[10px] text-white/30 tracking-wider uppercase" dir="ltr">SONA</span>
            </div>
          </a>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => { e.preventDefault(); scrollTo(l.href); }}
                className="relative px-4 py-2 text-[13px] font-medium text-white/60 hover:text-white transition-colors duration-300 group"
              >
                {l.label}
                <span className="absolute bottom-0 right-4 left-4 h-[2px] bg-gradient-to-l from-[#409eff] to-[#93c5fd] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-right" />
              </a>
            ))}
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white/40 hover:text-[#409eff] hover:bg-[#409eff]/5 transition-all duration-300"
              title={lang === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
            >
              <Globe size={16} />
              <span className="text-xs font-bold">{lang === 'ar' ? 'EN' : 'عربي'}</span>
            </button>
            <button
              onClick={() => setCurrentPage('login')}
              className="px-5 py-2.5 text-[#409eff] text-sm font-semibold hover:bg-[#409eff]/8 rounded-lg transition-all duration-300 border border-transparent hover:border-[#409eff]/15"
            >
              {t('landing.loginBtn')}
            </button>
            <button
              onClick={() => setCurrentPage('register')}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white font-semibold text-sm btn-shine hover:shadow-lg hover:shadow-[#409eff]/25 transition-all duration-300"
            >
              {t('landing.registerNowBtn')}
            </button>
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="lg:hidden p-2 text-white/70 hover:text-[#409eff] transition-colors"
            aria-label={isMobileOpen ? t('landing.closeMenuAria') : t('landing.openMenuAria')}
          >
            {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="lg:hidden bg-[#030708]/98 backdrop-blur-2xl border-b border-white/[0.06]"
          >
            <div className="px-4 py-6 space-y-1">
              {links.map((l, i) => (
                <motion.a
                  key={l.href}
                  href={l.href}
                  onClick={(e) => { e.preventDefault(); scrollTo(l.href); }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="block px-4 py-3 text-white/70 hover:text-[#409eff] hover:bg-white/[0.03] rounded-lg transition-all font-medium"
                >
                  {l.label}
                </motion.a>
              ))}
              <div className="pt-4 space-y-2 border-t border-white/[0.06] mt-4">
                <button
                  onClick={() => { setIsMobileOpen(false); setCurrentPage('login'); }}
                  className="block w-full px-4 py-3 text-[#409eff] font-semibold text-center hover:bg-[#409eff]/8 rounded-lg transition-all"
                >
                  {t('landing.loginBtn')}
                </button>
                <button
                  onClick={() => { setIsMobileOpen(false); setCurrentPage('register'); }}
                  className="block w-full px-4 py-3 bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white font-semibold rounded-lg text-center"
                >
                  {t('landing.registerNowBtn')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

/* ═══════════════════════════════════════════
   2. HERO SECTION
   ═══════════════════════════════════════════ */
function HeroSection() {
  const { setCurrentPage } = useAppStore();
  const { t } = useI18n();

  const heroStats = [
    { value: '$2.5', suffix: 'B+', label: t('landing.assetsUnderManagement'), icon: <BarChart3 size={18} /> },
    { value: '15,000', suffix: '+', label: t('landing.activeUsers'), icon: <Users size={18} /> },
    { value: '99.9', suffix: '%', label: t('landing.uptime'), icon: <Activity size={18} /> },
  ];

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Layers */}
      <div className="absolute inset-0 bg-[#030708]" />
      <div className="absolute inset-0 bg-cover bg-center opacity-[0.12] scale-105" style={{ backgroundImage: 'url(/hero-bg.png)' }} />
      <div className="absolute inset-0 animated-grid" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#030708]/70 via-[#030708]/50 to-[#030708]" />

      {/* Gradient Orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-[700px] h-[700px] rounded-full bg-[#409eff]/[0.04] blur-[150px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-[#409eff]/[0.06] blur-[120px]" style={{ animationDelay: '3s' }} />
      <div className="absolute top-[30%] left-[50%] w-[300px] h-[300px] rounded-full bg-[#337ecc]/[0.03] blur-[100px]" style={{ animationDelay: '5s' }} />

      {/* Floating Dots */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute w-[2px] h-[2px] bg-[#409eff]/40 rounded-full floating-dot"
          style={{
            top: `${15 + i * 10}%`,
            left: `${5 + i * 12}%`,
            animationDelay: `${i * 0.7}s`,
            animationDuration: `${4 + i * 0.8}s`,
          }}
        />
      ))}

      {/* Decorative Circles */}
      <div className="absolute top-[20%] left-[8%] w-72 h-72 rounded-full border border-[#409eff]/[0.06] parallax-float hidden xl:block" />
      <div className="absolute bottom-[25%] right-[6%] w-56 h-56 rounded-full border border-[#409eff]/[0.04] parallax-float hidden xl:block" style={{ animationDelay: '3s' }} />
      <div className="absolute top-[60%] left-[70%] w-40 h-40 rounded-full border border-[#409eff]/[0.05] parallax-float hidden xl:block" style={{ animationDelay: '5s' }} />

      {/* Crypto Icons Floating */}
      <div className="absolute top-[18%] right-[15%] hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl glass-gold parallax-float" style={{ animationDelay: '1s' }}>
        <Bitcoin size={20} className="text-[#f7931a]" />
        <span className="text-white/50 text-xs font-medium" dir="ltr">BTC</span>
      </div>
      <div className="absolute top-[30%] left-[10%] hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl glass-gold parallax-float" style={{ animationDelay: '3s' }}>
        <DollarSign size={20} className="text-[#26a17b]" />
        <span className="text-white/50 text-xs font-medium" dir="ltr">USDT</span>
      </div>
      <div className="absolute bottom-[30%] right-[12%] hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl glass-gold parallax-float" style={{ animationDelay: '5s' }}>
        <Sparkles size={20} className="text-[#627eea]" />
        <span className="text-white/50 text-xs font-medium" dir="ltr">ETH</span>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full glass-gold mb-10"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]" />
          </span>
          <span className="text-[#409eff] text-sm font-medium">{t('landing.professionalInvestment')}</span>
        </motion.div>

        {/* Main Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold leading-[1.1] mb-8"
        >
          <span className="text-white block">{t('landing.heroTitle1')}</span>
          <span className="gold-shimmer block mt-2">{t('landing.heroTitle2')}</span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="text-base sm:text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed"
        >
          {t('landing.heroSubDesc')}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
        >
          <motion.button
            onClick={() => setCurrentPage('register')}
            whileHover={{ scale: 1.03, boxShadow: '0 20px 40px rgba(201, 168, 76, 0.25)' }}
            whileTap={{ scale: 0.97 }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-l from-[#409eff] via-[#337ecc] to-[#409eff] text-white font-bold text-lg btn-shine transition-all duration-300"
          >
            {t('landing.startInvestingNow')}
            <ArrowLeft size={20} />
          </motion.button>
          <motion.button
            onClick={() => document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl border border-white/15 text-white/80 font-bold text-lg hover:bg-white/[0.04] hover:border-white/25 transition-all duration-300"
          >
            <Play size={18} className="text-[#409eff]" />
            {t('landing.watchHowItWorksShort')}
          </motion.button>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.9 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-3xl mx-auto"
        >
          {heroStats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.1 + i * 0.15 }}
              className="relative p-5 sm:p-6 rounded-xl glass-gold group hover:border-[#409eff]/25 transition-all duration-500"
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-[#409eff]/50">{s.icon}</span>
              </div>
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#409eff] mb-1">
                {s.value}
                <span className="text-[#93c5fd] text-lg sm:text-xl">{s.suffix}</span>
              </div>
              <div className="text-white/40 text-xs sm:text-sm">{s.label}</div>
              <div className="absolute inset-0 rounded-xl bg-[#409eff]/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Bottom Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#030708] to-transparent" />
    </section>
  );
}

/* ═══════════════════════════════════════════
   3. TRUSTED BY SECTION
   ═══════════════════════════════════════════ */
function TrustedBySection() {
  const { t } = useI18n();
  const partners = [
    { name: 'Bloomberg', style: 'font-light tracking-[0.3em] text-white/25' },
    { name: 'Reuters', style: 'font-serif tracking-[0.15em] text-white/25' },
    { name: 'CoinDesk', style: 'font-bold tracking-[0.1em] text-white/25' },
    { name: 'Forbes', style: 'font-serif italic tracking-[0.15em] text-white/25' },
    { name: 'CoinTelegraph', style: 'font-medium tracking-[0.08em] text-white/25' },
    { name: 'Nasdaq', style: 'font-extrabold tracking-[0.2em] text-white/25' },
  ];

  return (
    <Section className="py-16 sm:py-20 bg-[#030708]">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <p className="text-white/30 text-sm font-medium tracking-wide">
            {t('landing.trustedByInvestors')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 1, delay: 0.2 }}
          className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 md:gap-16"
        >
          {partners.map((p, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className={`text-lg sm:text-xl md:text-2xl ${p.style} hover:text-white/40 transition-colors duration-500 cursor-default select-none`}
              dir="ltr"
            >
              {p.name}
            </motion.span>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   4. HOW IT WORKS
   ═══════════════════════════════════════════ */
function HowItWorksSection() {
  const { setCurrentPage } = useAppStore();
  const { t } = useI18n();

  const steps = [
    {
      icon: <UserPlus size={28} />,
      title: t('landing.createAccount'),
      desc: t('landing.createAccountDesc'),
      step: '01',
    },
    {
      icon: <Wallet size={28} />,
      title: t('landing.depositCapital'),
      desc: t('landing.depositCapitalDesc'),
      step: '02',
    },
    {
      icon: <TrendingUp size={28} />,
      title: t('landing.startEarning'),
      desc: t('landing.startEarningDesc'),
      step: '03',
    },
  ];

  return (
    <Section id="how-it-works" className="py-24 sm:py-32 bg-[#030708]">
      <div className="absolute inset-0 pattern-bg" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 sm:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-gold mb-6">
            <span className="text-[#409eff] text-xs font-medium">{t('landing.simpleSteps')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5">
            <span className="text-white">{t('landing.howItWorks').split('؟')[0]}</span>
            <span className="gold-gradient-text">{t('landing.howItWorks').split('؟')[1] ? '؟' : ''}</span>
          </h2>
          <p className="text-white/40 max-w-lg mx-auto text-base">
            {t('landing.threeStepsDesc')}
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 relative">
          {/* Connector Lines (Desktop) */}
          <div className="hidden md:block absolute top-[72px] right-[33%] left-[33%]">
            <div className="h-[2px] bg-gradient-to-l from-[#409eff]/20 via-[#409eff]/40 to-[#409eff]/20" />
            <div className="absolute top-1/2 right-0 -translate-y-1/2 -translate-x-1/2">
              <ArrowUpRight size={16} className="text-[#409eff]/40 rotate-[135deg]" />
            </div>
            <div className="absolute top-1/2 left-0 -translate-y-1/2 translate-x-1/2">
              <ArrowUpRight size={16} className="text-[#409eff]/40 rotate-[135deg]" />
            </div>
          </div>

          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6, delay: i * 0.2 }}
              className="relative text-center group"
            >
              <div className="relative inline-flex items-center justify-center w-[88px] h-[88px] rounded-2xl bg-[#1f2634] border border-white/[0.06] text-[#409eff] mb-8 mx-auto transition-all duration-500 group-hover:border-[#409eff]/30 group-hover:bg-[#409eff]/[0.06] group-hover:shadow-lg group-hover:shadow-[#409eff]/[0.05]">
                {s.icon}
                <span className="absolute -top-3 -right-3 w-8 h-8 rounded-lg bg-gradient-to-br from-[#409eff] to-[#337ecc] text-white text-xs font-bold flex items-center justify-center shadow-md shadow-[#409eff]/20">
                  {s.step}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-4">{s.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto">{s.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-16"
        >
          <button
            onClick={() => setCurrentPage('register')}
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white font-bold hover:shadow-lg hover:shadow-[#409eff]/20 transition-all btn-shine"
          >
            {t('landing.startNow')} <ArrowLeft size={18} />
          </button>
        </motion.div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   5. INVESTMENT PACKAGES
   ═══════════════════════════════════════════ */
function PackageCard({ pkg, index, onRegister }: { pkg: Pkg; index: number; onRegister: () => void }) {
  const { t } = useI18n();
  const isFeatured = pkg.nameEn === 'Gold';
  const isDiamond = pkg.nameEn === 'Diamond';

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={`relative rounded-2xl p-5 sm:p-6 card-hover-border transition-all duration-500 group flex flex-col ${
        isFeatured
          ? 'bg-gradient-to-b from-[#409eff]/[0.08] to-[#1f2634] border border-[#409eff]/30 gold-glow'
          : isDiamond
          ? 'bg-gradient-to-b from-[#a8b4c0]/[0.06] to-[#1f2634] border border-white/10'
          : 'bg-[#1f2634] border border-white/[0.06] hover:border-[#409eff]/20'
      }`}
    >
      {isFeatured && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-gradient-to-l from-[#409eff] to-[#337ecc] rounded-full text-white text-xs font-bold shadow-lg shadow-[#409eff]/20 flex items-center gap-1.5">
          <Crown size={12} />
          {t('packages.mostPopular')}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="p-3 rounded-xl transition-colors duration-300"
          style={{
            backgroundColor: `${pkg.color}12`,
            color: pkg.color,
          }}
        >
          {iconMap[pkg.icon] || <Star size={28} />}
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ color: pkg.color }}>{pkg.name}</h3>
          <p className="text-white/30 text-xs">{pkg.nameEn} Package</p>
        </div>
      </div>

      <p className="text-white/50 text-sm mb-5 leading-relaxed line-clamp-2">{pkg.description}</p>

      {/* Key Metrics */}
      <div className="space-y-3 mb-6 flex-1">
        <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
          <span className="text-white/35 text-sm">{t('landing.dailyReturn')}</span>
          <span className="font-bold text-lg" style={{ color: pkg.color }}>{pkg.dailyReturn}%</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
          <span className="text-white/35 text-sm">{t('landing.durationDays')}</span>
          <span className="text-white/80 font-semibold">{pkg.durationDays} {t('landing.dayUnit')}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
          <span className="text-white/35 text-sm">{t('landing.amountLabel')}</span>
          <span className="text-white/80 font-semibold text-sm">
            {pkg.minAmount.toLocaleString()} – {pkg.maxAmount ? `${pkg.maxAmount.toLocaleString()}` : t('landing.noLimit')}
          </span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-white/35 text-sm">{t('landing.monthlyReturnExpected')}</span>
          <span className="font-bold text-[#22c55e]">{safeFixed((pkg.dailyReturn || 0) * 30, 1)}%</span>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onRegister}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 mt-auto ${
          isFeatured
            ? 'bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white hover:shadow-lg hover:shadow-[#409eff]/20 btn-shine'
            : 'border border-[#409eff]/25 text-[#409eff] hover:bg-[#409eff]/8 hover:border-[#409eff]/40'
        }`}
      >
        {t('packages.investNow')}
      </button>
    </motion.div>
  );
}

function PackagesSection() {
  const { setCurrentPage } = useAppStore();
  const { t } = useI18n();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        let res = await fetch('/api/packages');
        let data = await res.json();
        if (!data.packages || data.packages.length === 0) {
          await fetch('/api/packages/seed', { method: 'POST' });
          res = await fetch('/api/packages');
          data = await res.json();
        }
        setPackages(data.packages || []);
      } catch {
        // error
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <Section id="packages" className="py-24 sm:py-32 bg-[#030708]">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 sm:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-gold mb-6">
            <Crown size={14} className="text-[#409eff]" />
            <span className="text-[#409eff] text-xs font-medium">{t('landing.exclusivePackages')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5">
            <span className="text-white">{t('landing.designedForEveryInvestor')}</span>
          </h2>
          <p className="text-white/40 max-w-lg mx-auto text-base">
            {t('landing.choosePackageDesc')}
          </p>
        </motion.div>

        {loading ? (
          <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="min-w-[280px] sm:min-w-[320px] h-[420px] rounded-2xl bg-[#1f2634] animate-pulse flex-shrink-0 snap-center" />
            ))}
          </div>
        ) : (
          <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-5 lg:overflow-visible">
            {packages.map((pkg, i) => (
              <div key={pkg.id} className="min-w-[280px] sm:min-w-[300px] flex-shrink-0 snap-center lg:min-w-0">
                <PackageCard pkg={pkg} index={i} onRegister={() => setCurrentPage('register')} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   6. PLATFORM FEATURES
   ═══════════════════════════════════════════ */
function FeaturesSection() {
  const { t } = useI18n();
  const features = [
    {
      icon: <Shield size={26} />,
      title: t('landing.institutionalSecurity'),
      desc: t('landing.institutionalSecurityDesc'),
    },
    {
      icon: <TrendingUp size={26} />,
      title: t('landing.investmentReturns'),
      desc: t('landing.investmentReturnsDesc'),
    },
    {
      icon: <Headphones size={26} />,
      title: t('landing.support247'),
      desc: t('landing.support247Desc'),
    },
    {
      icon: <Bitcoin size={26} />,
      title: t('landing.multipleCrypto'),
      desc: t('landing.multipleCryptoDesc'),
    },
    {
      icon: <Eye size={26} />,
      title: t('landing.fullTransparency'),
      desc: t('landing.fullTransparencyDesc'),
    },
    {
      icon: <CircleDollarSign size={26} />,
      title: t('landing.zeroCommissions'),
      desc: t('landing.zeroCommissionsDesc'),
    },
  ];

  return (
    <Section id="features" className="py-24 sm:py-32 bg-[#030708]">
      <div className="absolute inset-0 pattern-bg" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 sm:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-gold mb-6">
            <Layers size={14} className="text-[#409eff]" />
            <span className="text-[#409eff] text-xs font-medium">{t('landing.platformFeatures')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5">
            <span className="text-white">{t('landing.whyTrustSona')}</span>
          </h2>
          <p className="text-white/40 max-w-lg mx-auto text-base">
            {t('landing.whyTrustDesc')}
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="relative p-6 sm:p-7 rounded-2xl bg-[#1f2634] border border-white/[0.05] card-hover-border group hover:bg-[#141414] transition-all duration-500"
            >
              <div className="p-3.5 rounded-xl bg-[#409eff]/[0.08] text-[#409eff] mb-5 inline-flex group-hover:bg-[#409eff]/[0.14] transition-colors duration-300">
                {f.icon}
              </div>
              <h3 className="text-white font-bold text-lg mb-3 group-hover:text-[#93c5fd] transition-colors duration-300">{f.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
              <div className="absolute top-0 left-0 w-full h-[2px] rounded-t-2xl bg-gradient-to-l from-transparent via-[#409eff]/0 to-transparent group-hover:via-[#409eff]/40 transition-all duration-500" />
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   7. SECURITY SECTION
   ═══════════════════════════════════════════ */
function SecuritySection() {
  const { t } = useI18n();
  const securityFeatures = [
    { text: t('landing.sslEncryption') },
    { text: t('landing.twoFactor') },
    { text: t('landing.coldWallets') },
    { text: t('landing.security247') },
    { text: t('landing.periodicAudit') },
  ];

  const trustBadges = [
    { label: t('landing.licensedBadge'), icon: <ShieldCheck size={18} /> },
    { label: t('landing.insuredBadge'), icon: <Lock size={18} /> },
    { label: t('landing.certifiedBadge'), icon: <Award size={18} /> },
  ];

  return (
    <Section id="security" className="py-24 sm:py-32 bg-[#030708]">
      <div className="absolute inset-0 pattern-bg" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 sm:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-gold mb-6">
            <ShieldCheck size={14} className="text-[#409eff]" />
            <span className="text-[#409eff] text-xs font-medium">{t('landing.advancedProtection')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5">
            <span className="text-white">{t('landing.securityPriority')}</span>
          </h2>
          <p className="text-white/40 max-w-lg mx-auto text-base">
            {t('landing.securityDesc')}
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Security Features */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7 }}
          >
            <div className="space-y-4">
              {securityFeatures.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-4 p-4 rounded-xl bg-[#1f2634] border border-white/[0.04] hover:border-[#409eff]/15 transition-all duration-300 group"
                >
                  <div className="p-1.5 rounded-lg bg-[#22c55e]/10 text-[#22c55e] flex-shrink-0 mt-0.5 group-hover:bg-[#22c55e]/20 transition-colors">
                    <CheckCircle size={18} />
                  </div>
                  <span className="text-white/60 text-sm leading-relaxed group-hover:text-white/80 transition-colors">{f.text}</span>
                </motion.div>
              ))}
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap gap-3 mt-8">
              {trustBadges.map((b, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl glass-gold text-[#409eff] text-sm font-medium"
                >
                  {b.icon}
                  {b.label}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Security Image */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7 }}
            className="relative flex items-center justify-center"
          >
            <div className="relative w-full max-w-md mx-auto">
              {/* Glow Effect */}
              <div className="absolute inset-0 rounded-3xl bg-[#409eff]/[0.06] blur-3xl scale-110" />
              <div className="relative rounded-3xl overflow-hidden border border-[#409eff]/15 gold-glow">
                <img
                  src="/security-icon.png"
                  alt={t('landing.securityImage')}
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030708]/60 via-transparent to-transparent" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </Section>
  );
}

/* ─── Individual Stat Item (uses hook at top level) ─── */
function StatItem({ stat, index }: { stat: { end: number; prefix: string; suffix: string; label: string; decimals: number }; index: number }) {
  const { count, ref } = useCountUp(stat.end, 2500);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      className="text-center p-6 sm:p-8 rounded-2xl glass-gold group hover:border-[#409eff]/25 transition-all duration-500"
    >
      <div className="text-3xl sm:text-4xl md:text-5xl font-bold gold-gradient-text mb-3">
        {stat.prefix}{stat.decimals > 0 ? safeFixed(count, stat.decimals) : Math.floor(count ?? 0).toLocaleString()}{stat.suffix}
      </div>
      <div className="text-white/40 text-sm font-medium">{stat.label}</div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   8. LIVE STATS COUNTER
   ═══════════════════════════════════════════ */
function StatsSection() {
  const { t } = useI18n();
  const stats = [
    { end: 2.5, prefix: '$', suffix: 'B+', label: t('landing.assetsUnderManagement'), decimals: 1 },
    { end: 15000, prefix: '', suffix: '+', label: t('landing.activeUsers'), decimals: 0 },
    { end: 99.9, prefix: '', suffix: '%', label: t('landing.uptime'), decimals: 1 },
    { end: 50, prefix: '$', suffix: 'M+', label: t('landing.profitsDistributed'), decimals: 0 },
  ];

  return (
    <Section className="py-20 sm:py-24 bg-[#030708]">
      <div className="absolute inset-0 bg-gradient-to-b from-[#409eff]/[0.02] via-transparent to-transparent" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {stats.map((s, i) => (
            <StatItem key={i} stat={s} index={i} />
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   9. TESTIMONIALS
   ═══════════════════════════════════════════ */
function TestimonialsSection() {
  const { t } = useI18n();
  const [active, setActive] = useState(0);

  const testimonials = [
    {
      name: 'David M.',
      role: t('landing.investorSince', { year: '2021' }),
      text: t('landing.testimonial1'),
      avatar: 'D',
      rating: 5,
    },
    {
      name: 'Sami K.',
      role: t('landing.investorSince', { year: '2022' }),
      text: t('landing.testimonial2'),
      avatar: 'S',
      rating: 5,
    },
    {
      name: 'James L.',
      role: t('landing.investorSince', { year: '2020' }),
      text: t('landing.testimonial3'),
      avatar: 'J',
      rating: 5,
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  return (
    <Section className="py-24 sm:py-32 bg-[#030708]">
      <div className="absolute inset-0 pattern-bg" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 sm:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-gold mb-6">
            <Quote size={14} className="text-[#409eff]" />
            <span className="text-[#409eff] text-xs font-medium">{t('landing.testimonialsTitle')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5">
            <span className="text-white">{t('landing.whatOurClientsSay')}</span>
          </h2>
          <p className="text-white/40 max-w-lg mx-auto text-base">
            {t('landing.thousandsTrustUs')}
          </p>
        </motion.div>

        {/* Desktop Grid */}
        <div className="hidden md:grid md:grid-cols-3 gap-6">
          {testimonials.map((tm, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative p-6 sm:p-7 rounded-2xl bg-[#1f2634] border border-white/[0.05] card-hover-border group"
            >
              <Quote size={32} className="text-[#409eff]/10 absolute top-4 left-4" />
              <div className="flex items-center gap-1 mb-5">
                {[...Array(tm.rating)].map((_, j) => (
                  <Star key={j} size={14} className="text-[#409eff] fill-[#409eff]" />
                ))}
              </div>
              <p className="text-white/55 text-sm leading-relaxed mb-6">{tm.text}</p>
              <div className="flex items-center gap-3 pt-5 border-t border-white/[0.05]">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#409eff] to-[#337ecc] flex items-center justify-center text-white font-bold text-sm shadow-md shadow-[#409eff]/15">
                  {tm.avatar}
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">{tm.name}</div>
                  <div className="text-white/35 text-xs">{tm.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile Carousel */}
        <div className="md:hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
              className="p-6 rounded-2xl bg-[#1f2634] border border-white/[0.05]"
            >
              <Quote size={32} className="text-[#409eff]/10 absolute top-4 left-4" />
              <div className="flex items-center gap-1 mb-5">
                {[...Array(testimonials[active].rating)].map((_, j) => (
                  <Star key={j} size={14} className="text-[#409eff] fill-[#409eff]" />
                ))}
              </div>
              <p className="text-white/55 text-sm leading-relaxed mb-6">{testimonials[active].text}</p>
              <div className="flex items-center gap-3 pt-5 border-t border-white/[0.05]">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#409eff] to-[#337ecc] flex items-center justify-center text-white font-bold text-sm">
                  {testimonials[active].avatar}
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">{testimonials[active].name}</div>
                  <div className="text-white/35 text-xs">{testimonials[active].role}</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Carousel Controls */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={() => setActive((prev) => (prev - 1 + testimonials.length) % testimonials.length)}
              className="p-2 rounded-lg border border-white/10 text-white/40 hover:text-[#409eff] hover:border-[#409eff]/30 transition-all"
              aria-label={t('landing.previousTestimonial')}
            >
              <ChevronRight size={18} />
            </button>
            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    i === active ? 'bg-[#409eff] w-6' : 'bg-white/20 hover:bg-white/40'
                  }`}
                  aria-label={`${t('landing.testimonialsTitle')} ${i + 1}`}
                />
              ))}
            </div>
            <button
              onClick={() => setActive((prev) => (prev + 1) % testimonials.length)}
              className="p-2 rounded-lg border border-white/10 text-white/40 hover:text-[#409eff] hover:border-[#409eff]/30 transition-all"
              aria-label={t('landing.nextTestimonial')}
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   10. CTA SECTION
   ═══════════════════════════════════════════ */
function CTASection() {
  const { setCurrentPage } = useAppStore();
  const { t } = useI18n();

  return (
    <Section className="py-24 sm:py-32 bg-[#030708]">
      <div className="absolute inset-0 bg-gradient-to-b from-[#030708] via-[#409eff]/[0.03] to-[#030708]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#409eff]/[0.03] blur-[150px]" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.7 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-gold mb-8">
            <Sparkles size={14} className="text-[#409eff]" />
            <span className="text-[#409eff] text-xs font-medium">{t('landing.ctaStartToday')}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold mb-6 leading-tight">
            <span className="text-white">{t('landing.ctaYourFinancialFuture')}</span>
          </h2>

          <p className="text-white/45 text-base sm:text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            {t('landing.ctaDesc')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <motion.button
              onClick={() => setCurrentPage('register')}
              whileHover={{ scale: 1.03, boxShadow: '0 20px 40px rgba(201, 168, 76, 0.25)' }}
              whileTap={{ scale: 0.97 }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-10 py-4 rounded-xl bg-gradient-to-l from-[#409eff] via-[#337ecc] to-[#409eff] text-white font-bold text-lg btn-shine transition-all duration-300"
            >
              {t('landing.registerNowFree')}
              <ArrowLeft size={20} />
            </motion.button>
            <motion.button
              onClick={() => setCurrentPage('login')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-10 py-4 rounded-xl border-2 border-[#409eff]/25 text-[#409eff] font-bold text-lg hover:bg-[#409eff]/8 hover:border-[#409eff]/40 transition-all duration-300"
            >
              {t('landing.loginBtn')}
            </motion.button>
          </div>

          <p className="text-white/25 text-xs sm:text-sm">
            {t('landing.noCreditCard')}
          </p>
        </motion.div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   11. FOOTER
   ═══════════════════════════════════════════ */
function Footer() {
  const { setCurrentPage } = useAppStore();
  const { t } = useI18n();

  const columns = [
    {
      title: t('landing.footerPlatform'),
      links: [
        { label: t('landing.home'), action: () => document.querySelector('#hero')?.scrollIntoView({ behavior: 'smooth' }) },
        { label: t('landing.packages'), action: () => document.querySelector('#packages')?.scrollIntoView({ behavior: 'smooth' }) },
        { label: t('landing.aboutUs'), action: () => document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' }) },
        { label: t('landing.securityLink'), action: () => document.querySelector('#security')?.scrollIntoView({ behavior: 'smooth' }) },
      ],
    },
    {
      title: t('landing.footerInvestment'),
      links: [
        { label: t('landing.footerStarterPkg'), action: () => setCurrentPage('register') },
        { label: t('landing.footerSilverPkg'), action: () => setCurrentPage('register') },
        { label: t('landing.footerGoldPkg'), action: () => setCurrentPage('register') },
        { label: t('landing.footerPlatinumPkg'), action: () => setCurrentPage('register') },
        { label: t('landing.footerDiamondPkg'), action: () => setCurrentPage('register') },
      ],
    },
    {
      title: t('landing.footerSupport'),
      links: [
        { label: t('landing.footerHelpCenter'), action: () => {} },
        { label: t('landing.footerFAQ'), action: () => {} },
        { label: t('landing.contactUs'), action: () => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' }) },
        { label: t('landing.footerTermsAndConditions'), action: () => {} },
      ],
    },
    {
      title: t('landing.footerLegal'),
      links: [
        { label: t('landing.footerPrivacyPolicy'), action: () => {} },
        { label: t('landing.footerTermsOfUse'), action: () => {} },
        { label: t('landing.footerAML'), action: () => {} },
        { label: t('landing.footerRiskDisclosure'), action: () => {} },
      ],
    },
  ];

  const socialLinks = [
    { icon: <ExternalLink size={18} />, label: 'Twitter', href: '#' },
    { icon: <Link2 size={18} />, label: 'LinkedIn', href: '#' },
    { icon: <Send size={18} />, label: 'Telegram', href: '#' },
  ];

  return (
    <footer id="contact" className="relative bg-[#030708] border-t border-white/[0.05]">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer */}
        <div className="py-12 sm:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12">
            {/* Logo Column */}
            <div className="col-span-2 md:col-span-4 lg:col-span-1 mb-4 lg:mb-0">
              <div className="flex items-center gap-3 mb-4">
                <img src="/logo-premium.png" alt={t('common.appName')} className="w-9 h-9 rounded-lg object-cover" />
                <div>
                  <span className="gold-shimmer text-xl font-bold">{t('common.appName')}</span>
                </div>
              </div>
              <p className="text-white/30 text-sm leading-relaxed mb-6 max-w-xs">
                {t('landing.footerDesc')}
              </p>
              <div className="flex items-center gap-3">
                {socialLinks.map((s, i) => (
                  <a
                    key={i}
                    href={s.href}
                    aria-label={s.label}
                    className="p-2.5 rounded-lg border border-white/[0.06] text-white/30 hover:text-[#409eff] hover:border-[#409eff]/20 transition-all duration-300"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Link Columns */}
            {columns.map((col, i) => (
              <div key={i}>
                <h4 className="text-white font-semibold text-sm mb-4">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map((link, j) => (
                    <li key={j}>
                      <button
                        onClick={link.action}
                        className="text-white/30 text-sm hover:text-[#409eff] transition-colors duration-300"
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Info Bar */}
        <div className="py-6 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
          <div className="flex items-center gap-2 text-white/30 text-sm">
            <Mail size={14} className="text-[#409eff]/50" />
            <span dir="ltr">support@sonainvest.com</span>
          </div>
          <div className="flex items-center gap-2 text-white/30 text-sm">
            <Globe size={14} className="text-[#409eff]/50" />
            <span dir="ltr">sonainvest.com</span>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/20 text-xs">
            © 2026 SONA Digital Assets Ltd. {t('footer.rights')}.
          </p>
          <p className="text-white/15 text-xs text-center sm:text-left max-w-md">
            {t('landing.riskWarning')}
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════
   MAIN LANDING PAGE
   ═══════════════════════════════════════════ */
export default function LandingPage() {
  const { dir } = useI18n();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const h = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <main className="min-h-screen bg-[#030708]" dir={dir}>
      <LandingNavbar />
      <HeroSection />
      <div className="section-divider" />
      <TrustedBySection />
      <div className="section-divider" />
      <HowItWorksSection />
      <div className="section-divider" />
      <PackagesSection />
      <div className="section-divider" />
      <FeaturesSection />
      <div className="section-divider" />
      <SecuritySection />
      <div className="section-divider" />
      <StatsSection />
      <div className="section-divider" />
      <TestimonialsSection />
      <div className="section-divider" />
      <CTASection />
      <div className="section-divider" />
      <Footer />

      {/* Scroll to Top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 left-6 p-3 rounded-full bg-gradient-to-br from-[#409eff] to-[#337ecc] text-white shadow-lg shadow-[#409eff]/20 z-40 hover:scale-110 transition-transform"
            aria-label={t('landing.backToTop')}
          >
            <ChevronUp size={20} />
          </motion.button>
        )}
      </AnimatePresence>
    </main>
  );
}
