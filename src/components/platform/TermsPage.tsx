'use client';

import { motion } from 'framer-motion';
import {
  FileText,
  Scale,
  ChevronDown,
  Mail,
} from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '@/hooks/useI18n';

export default function TermsPage() {
  const { t, isRTL, dir } = useI18n();
  const [expandedSection, setExpandedSection] = useState<number | null>(0);

  const sections = [
    { title: t('terms.s1Title'), content: [t('terms.s1c1'), t('terms.s1c2'), t('terms.s1c3')] },
    { title: t('terms.s2Title'), content: [t('terms.s2c1'), t('terms.s2c2'), t('terms.s2c3')] },
    { title: t('terms.s3Title'), content: [t('terms.s3c1'), t('terms.s3c2'), t('terms.s3c3')] },
    { title: t('terms.s4Title'), content: [t('terms.s4c1'), t('terms.s4c2'), t('terms.s4c3'), t('terms.s4c4')] },
    { title: t('terms.s5Title'), content: [t('terms.s5c1'), t('terms.s5c2'), t('terms.s5c3')] },
    { title: t('terms.s6Title'), content: [t('terms.s6c1'), t('terms.s6c2'), t('terms.s6c3')] },
    { title: t('terms.s7Title'), content: [t('terms.s7c1'), t('terms.s7c2')] },
    { title: t('terms.s8Title'), content: [t('terms.s8c1'), t('terms.s8c2'), t('terms.s8c3')] },
    { title: t('terms.s9Title'), content: [t('terms.s9c1'), t('terms.s9c2'), t('terms.s9c3')] },
    { title: t('terms.s10Title'), content: [t('terms.s10c1'), t('terms.s10c2')] },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto" dir={dir}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <FileText size={22} className="text-[#409eff]" />
          {t('terms.title')}
        </h2>
        <p className="text-white/30 text-sm mt-1">{t('terms.lastUpdate')}</p>
      </motion.div>

      {/* Legal Notice */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="p-4 rounded-xl bg-blue-500/[0.04] border border-blue-500/10">
        <div className="flex items-start gap-2">
          <Scale size={14} className="text-blue-400 shrink-0 mt-0.5" />
          <p className="text-blue-400/70 text-xs leading-relaxed">
            {t('terms.legalNotice')}
          </p>
        </div>
      </motion.div>

      {/* Sections */}
      <div className="space-y-2">
        {sections.map((section, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.03 }}
            className="rounded-xl bg-[#1f2634] border border-white/5 overflow-hidden"
          >
            <button
              onClick={() => setExpandedSection(expandedSection === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-right hover:bg-white/[0.01] transition-colors"
            >
              <span className="text-white font-semibold text-sm">{section.title}</span>
              <ChevronDown
                size={16}
                className={`text-white/30 transition-transform duration-200 ${expandedSection === i ? 'rotate-180' : ''}`}
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
        ))}
      </div>

      {/* Contact */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="p-4 rounded-xl bg-[#1f2634] border border-white/5">
        <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
          <Mail size={14} className="text-[#409eff]" />
          {t('terms.legalInquiries')}
        </h3>
        <p className="text-white/30 text-xs leading-relaxed">
          {t('terms.legalInquiriesDesc')}
        </p>
      </motion.div>
    </div>
  );
}
