'use client';

import { motion } from 'framer-motion';
import {
  Building2,
  Shield,
  Globe,
  Award,
  Users,
  TrendingUp,
  Lock,
  Headphones,
  FileCheck,
  BadgeCheck,
  MapPin,
  Mail,
} from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';

export default function AboutPage() {
  const { t, isRTL, dir } = useI18n();

  const stats = [
    { label: t('about.statActiveInvestor'), value: '12,500+', icon: Users },
    { label: t('about.statTotalProfitsDistributed'), value: '$4.2M', icon: TrendingUp },
    { label: t('about.statYearsInMarket'), value: '5+', icon: Award },
    { label: t('about.statCountriesWorldwide'), value: '45+', icon: Globe },
  ];

  const features = [
    { icon: Lock, title: t('about.featureAdvancedSecurity'), desc: t('about.featureAdvancedSecurityDesc') },
    { icon: TrendingUp, title: t('about.featureDailyProfits'), desc: t('about.featureDailyProfitsDesc') },
    { icon: Shield, title: t('about.featureSecurePlatform'), desc: t('about.featureSecurePlatformDesc') },
    { icon: Headphones, title: t('about.featureContinuousSupport'), desc: t('about.featureContinuousSupportDesc') },
    { icon: Globe, title: t('about.featureGlobal'), desc: t('about.featureGlobalDesc') },
    { icon: FileCheck, title: t('about.featureFullTransparency'), desc: t('about.featureFullTransparencyDesc') },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto" dir={dir}>
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center py-6">
        <img src="/sona-icon.png" alt="SONA" className="w-16 h-16 rounded-2xl object-contain mx-auto mb-4" style={{filter:"drop-shadow(0 4px 15px rgba(64,158,255,0.35))"}} />
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{t('about.heroTitle')}</h2>
        <p className="text-white/40 text-sm max-w-lg mx-auto leading-relaxed">
          {t('about.heroDesc')}
        </p>
      </motion.div>

      {/* License Badges */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-[#1f2634] border border-white/5 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-green-500/10 shrink-0">
            <BadgeCheck size={20} className="text-green-400" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm">{t('about.advancedEncryption')}</div>
            <div className="text-green-400/60 text-xs" dir="ltr">{t('about.advancedEncryptionDesc')}</div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#1f2634] border border-white/5 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 shrink-0">
            <FileCheck size={20} className="text-blue-400" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm">{t('about.monitoring247')}</div>
            <div className="text-blue-400/60 text-xs" dir="ltr">{t('about.monitoring247Desc')}</div>
          </div>
        </div>
      </motion.div>

      {/* Company Info */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="p-5 rounded-xl bg-[#1f2634] border border-white/5">
        <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
          <Building2 size={16} className="text-[#409eff]" />
          {t('about.legalInfo')}
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-white/30 text-xs min-w-[80px]">{t('about.legalName')}</span>
            <span className="text-white/70 text-xs" dir="ltr">SONA Digital Assets Ltd.</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-white/30 text-xs min-w-[80px]">{t('about.registrationNo')}</span>
            <span className="text-white/70 text-xs" dir="ltr">Company #12847562</span>
          </div>
          <div className="flex items-start gap-3">
            <MapPin size={12} className="text-white/30 mt-0.5 shrink-0" />
            <span className="text-white/50 text-xs">{t('about.location')}</span>
          </div>
          <div className="flex items-start gap-3">
            <Mail size={12} className="text-white/30 mt-0.5 shrink-0" />
            <span className="text-white/50 text-xs" dir="ltr">helpsona.support@gmail.com</span>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="p-4 rounded-xl bg-[#1f2634] border border-white/5 text-center">
              <Icon size={18} className="text-[#409eff] mx-auto mb-2" />
              <div className="text-lg font-bold text-white">{s.value}</div>
              <div className="text-white/30 text-[10px] mt-0.5">{s.label}</div>
            </div>
          );
        })}
      </motion.div>

      {/* Features */}
      <div>
        <h3 className="text-white font-bold text-lg mb-4 text-center">{t('about.whySona')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                className="p-4 rounded-xl bg-[#1f2634] border border-white/5"
              >
                <div className="p-2 rounded-lg bg-[#409eff]/10 w-fit mb-3">
                  <Icon size={16} className="text-[#409eff]" />
                </div>
                <h4 className="text-white font-semibold text-sm mb-1">{f.title}</h4>
                <p className="text-white/30 text-xs leading-relaxed">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Mission */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="p-5 rounded-xl bg-gradient-to-l from-[#409eff]/[0.04] to-[#1f2634] border border-[#409eff]/10 text-center">
        <h3 className="text-white font-bold text-base mb-2">{t('about.mission')}</h3>
        <p className="text-white/40 text-sm leading-relaxed max-w-lg mx-auto">
          {t('about.missionText')}
        </p>
      </motion.div>
    </div>
  );
}
