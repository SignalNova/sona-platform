'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownToLine, Sparkles, TrendingUp, X } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { useAppStore } from '@/lib/store';

interface WelcomeOverlayProps {
  onClose: () => void;
}

const WELCOME_KEY = 'sona_welcomed';

export default function WelcomeOverlay({ onClose }: WelcomeOverlayProps) {
  const { t, isRTL, dir } = useI18n();
  const { setDashboardPage } = useAppStore();

  const handleCta = () => {
    try {
      localStorage.setItem(WELCOME_KEY, 'true');
    } catch {}
    setDashboardPage('packages');
    onClose();
  };

  const handleSkip = () => {
    try {
      localStorage.setItem(WELCOME_KEY, 'true');
    } catch {}
    onClose();
  };

  const steps = [
    {
      num: 1,
      icon: ArrowDownToLine,
      text: t('dashboard.welcomeOverlayStep1'),
    },
    {
      num: 2,
      icon: Sparkles,
      text: t('dashboard.welcomeOverlayStep2'),
    },
    {
      num: 3,
      icon: TrendingUp,
      text: t('dashboard.welcomeOverlayStep3'),
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        dir={dir}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
          onClick={handleSkip}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md rounded-2xl border border-white/10 overflow-hidden"
          style={{ background: 'linear-gradient(180deg, #0d1117 0%, #030708 100%)' }}
        >
          {/* Top gradient glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full bg-gradient-to-r from-[#409eff]/20 to-[#14B8A6]/10 blur-[80px] pointer-events-none" />

          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 end-4 z-10 p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
          >
            <X size={16} />
          </button>

          <div className="relative p-6 sm:p-8 pt-8">
            {/* SONA Logo/Icon */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="flex justify-center mb-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#409eff] to-[#14B8A6] flex items-center justify-center shadow-lg shadow-[#409eff]/20">
                <span className="text-white font-bold text-xl">S</span>
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-2xl sm:text-3xl font-bold text-white text-center mb-3"
            >
              {t('dashboard.welcomeOverlayTitle')}
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="text-white/50 text-sm sm:text-base text-center leading-relaxed mb-8"
            >
              {t('dashboard.welcomeOverlayDesc')}
            </motion.p>

            {/* Steps */}
            <div className="space-y-4 mb-8">
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.num}
                    initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
                    className="flex items-center gap-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all"
                  >
                    {/* Number circle */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#409eff] to-[#14B8A6] flex items-center justify-center shrink-0 shadow-md shadow-[#409eff]/15">
                      <span className="text-white font-bold text-sm">{step.num}</span>
                    </div>
                    {/* Icon */}
                    <div className="p-2 rounded-lg bg-[#409eff]/10 shrink-0">
                      <Icon size={18} className="text-[#409eff]" />
                    </div>
                    {/* Text */}
                    <p className="text-white/80 text-sm font-medium flex-1">
                      {step.text}
                    </p>
                  </motion.div>
                );
              })}
            </div>

            {/* CTA Button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.4 }}
              onClick={handleCta}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#409eff] to-[#14B8A6] text-white font-bold text-base shadow-lg shadow-[#409eff]/25 hover:shadow-[#409eff]/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              {t('dashboard.welcomeOverlayCta')}
            </motion.button>

            {/* Skip link */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.4 }}
              onClick={handleSkip}
              className="w-full mt-3 py-2.5 text-white/30 text-sm font-medium hover:text-white/50 transition-colors"
            >
              {t('dashboard.welcomeOverlaySkip')}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
