'use client';

import { motion } from 'framer-motion';
import {
  Shield,
  Eye,
  Lock,
  Database,
  Bell,
  Globe,
  Users,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '@/hooks/useI18n';

export default function PrivacyPage() {
  const { t, isRTL, dir } = useI18n();
  const [expandedSection, setExpandedSection] = useState<number | null>(0);

  const sections = [
    { title: t('privacy.s1Title'), icon: Database, content: [t('privacy.s1c1'), t('privacy.s1c2'), t('privacy.s1c3')] },
    { title: t('privacy.s2Title'), icon: Eye, content: [t('privacy.s2c1'), t('privacy.s2c2'), t('privacy.s2c3'), t('privacy.s2c4')] },
    { title: t('privacy.s3Title'), icon: Lock, content: [t('privacy.s3c1'), t('privacy.s3c2'), t('privacy.s3c3'), t('privacy.s3c4')] },
    { title: t('privacy.s4Title'), icon: Users, content: [t('privacy.s4c1'), t('privacy.s4c2'), t('privacy.s4c3')] },
    { title: t('privacy.s5Title'), icon: Globe, content: [t('privacy.s5c1'), t('privacy.s5c2'), t('privacy.s5c3')] },
    { title: t('privacy.s6Title'), icon: Shield, content: [t('privacy.s6c1'), t('privacy.s6c2'), t('privacy.s6c3'), t('privacy.s6c4')] },
    { title: t('privacy.s7Title'), icon: Bell, content: [t('privacy.s7c1'), t('privacy.s7c2'), t('privacy.s7c3')] },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto" dir={dir}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <Shield size={22} className="text-[#409eff]" />
          {t('privacy.title')}
        </h2>
        <p className="text-white/30 text-sm mt-1">{t('privacy.lastUpdate')}</p>
      </motion.div>

      {/* Overview */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="p-5 rounded-xl bg-gradient-to-l from-[#409eff]/[0.04] to-[#1f2634] border border-[#409eff]/10">
        <p className="text-white/50 text-xs leading-relaxed">
          {t('privacy.overview')}
        </p>
      </motion.div>

      {/* Key Points */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Lock, label: t('privacy.aes256'), desc: t('privacy.aes256Desc') },
          { icon: Shield, label: t('privacy.gdprCompliance'), desc: t('privacy.gdprDesc') },
          { icon: Eye, label: t('privacy.fullTransparency'), desc: t('privacy.fullTransparencyDesc') },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="p-3 rounded-xl bg-[#1f2634] border border-white/5 text-center"
            >
              <Icon size={16} className="text-[#409eff] mx-auto mb-1.5" />
              <div className="text-white text-[11px] font-semibold">{item.label}</div>
              <div className="text-white/25 text-[9px] mt-0.5">{item.desc}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {sections.map((section, i) => {
          const Icon = section.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.03 }}
              className="rounded-xl bg-[#1f2634] border border-white/5 overflow-hidden"
            >
              <button
                onClick={() => setExpandedSection(expandedSection === i ? null : i)}
                className="w-full flex items-center gap-3 p-4 text-right hover:bg-white/[0.01] transition-colors"
              >
                <div className="p-1.5 rounded-lg bg-[#409eff]/10 shrink-0">
                  <Icon size={14} className="text-[#409eff]" />
                </div>
                <span className="text-white font-semibold text-sm flex-1">{section.title}</span>
                <ChevronDown
                  size={16}
                  className={`text-white/30 transition-transform duration-200 shrink-0 ${expandedSection === i ? 'rotate-180' : ''}`}
                />
              </button>
              {expandedSection === i && (
                <div className="px-4 pb-4 space-y-3">
                  {section.content.map((paragraph, j) => (
                    <p key={j} className="text-white/40 text-xs leading-relaxed">{paragraph}</p>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Data Controller */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="p-4 rounded-xl bg-[#1f2634] border border-white/5">
        <h3 className="text-white font-semibold text-sm mb-2">{t('privacy.dataController')}</h3>
        <p className="text-white/30 text-xs leading-relaxed">
          {t('privacy.dataControllerDesc')}
        </p>
        <p className="text-white/30 text-xs mt-2">
          {t('privacy.dataControllerContact')}
        </p>
      </motion.div>
    </div>
  );
}
