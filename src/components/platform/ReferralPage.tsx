'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Copy,
  CheckCircle,
  Gift,
  Share2,
  DollarSign,
  Loader2,
  UserPlus,
  Calendar,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';
import { safeFixed } from '@/lib/utils';

interface ReferralInfo {
  referralCode: string;
  referralBonus: number;
  totalReferrals: number;
  referrals: {
    id: string;
    name: string;
    createdAt: string;
    balance: number;
  }[];
}

export default function ReferralPage() {
  const { user } = useAppStore();
  const { t, isRTL, dir } = useI18n();
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [shareError, setShareError] = useState(false);

  useEffect(() => {
    loadReferralInfo();
  }, []);

  async function loadReferralInfo() {
    if (!user) return;
    try {
      const res = await fetch('/api/referral');
      if (res.ok) {
        const data = await res.json();
        setReferralInfo(data);
      }
    } catch {
      // error
    } finally {
      setLoading(false);
    }
  }

  const referralCode = referralInfo?.referralCode || user?.referralCode || '';
  const referralLink = typeof window !== 'undefined'
    ? `${window.location.origin}/referral/${referralCode}`
    : `${process.env.NEXT_PUBLIC_APP_URL || ''}/referral/${referralCode}`;

  const copyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Share with dynamic referral image (includes user's code)
  const shareReferral = useCallback(async () => {
    if (!referralCode) return;
    setSharing(true);
    setShareError(false);
    setShareSuccess(false);

    try {
      // Try to fetch the dynamic referral image that includes the user's code
      let file: File | null = null;
      try {
        const imageResponse = await fetch('/api/referral/image');
        if (imageResponse.ok) {
          const blob = await imageResponse.blob();
          if (blob.size > 1000) {
            file = new File([blob], 'sona-referral.png', { type: 'image/png' });
          }
        }
      } catch {
        // Dynamic image not available, try static
      }

      // Fallback to static share image
      if (!file) {
        try {
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const imageUrl = `${origin}/referral-share.png`;
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          if (blob.size > 1000) {
            file = new File([blob], 'sona-referral.png', { type: 'image/png' });
          }
        } catch {
          // Static image not available either
        }
      }

      // Check if Web Share API with files is supported
      if (navigator.share && file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: t('referral.shareTitle'),
          text: t('referral.shareText', { code: referralCode }),
          url: referralLink,
          files: [file],
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
        setSharing(false);
        return;
      }

      // Fallback: share without image
      if (navigator.share) {
        await navigator.share({
          title: t('referral.shareTitle'),
          text: t('referral.shareText', { code: referralCode }) + '\n' + referralLink,
          url: referralLink,
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
        setSharing(false);
        return;
      }

      // Web Share API not available - copy link to clipboard as fallback
      try {
        await navigator.clipboard.writeText(referralLink);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
      } catch {
        setShareError(true);
        setTimeout(() => setShareError(false), 3000);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setSharing(false);
        return;
      }
      // Final fallback: copy link
      try {
        await navigator.clipboard.writeText(referralLink);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
      } catch {
        setShareError(true);
        setTimeout(() => setShareError(false), 3000);
      }
    }
    setSharing(false);
  }, [referralCode, referralLink]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-[#409eff]" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Hero Card - Referral Code */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden"
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#409eff]/10 via-[#1f2634] to-[#1f2634]" />
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-l from-[#409eff] via-[#66b3ff] to-[#409eff]" />

        <div className="relative p-6 space-y-5">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#409eff]/15 border border-[#409eff]/25">
              <Sparkles size={22} className="text-[#409eff]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t('referral.programTitle')}</h2>
              <p className="text-white/40 text-xs">{t('referral.programDesc')}</p>
            </div>
          </div>

          {/* Referral Code Display */}
          <div className="text-center py-3">
            <p className="text-white/40 text-xs mb-3 font-medium">{t('referral.yourCode')}</p>
            <div className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-[#0f141e]/90 border border-[#409eff]/20 backdrop-blur-sm shadow-[0_0_30px_rgba(64,158,255,0.06)]">
              <span
                className="text-[#409eff] font-mono font-black text-4xl tracking-[0.25em]"
                dir="ltr"
              >
                {referralCode || '--------'}
              </span>
            </div>
          </div>

          {/* Copy Code Button */}
          <button
            onClick={copyCode}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-medium hover:bg-white/10 hover:text-white transition-all"
          >
            {copiedCode ? (
              <>
                <CheckCircle size={14} className="text-green-400" />
                <span className="text-green-400">{t('referral.codeCopied')}</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                {t('referral.copyCode')}
              </>
            )}
          </button>

          {/* Share Button - Main CTA */}
          <button
            onClick={shareReferral}
            disabled={sharing}
            className="w-full py-4 rounded-xl bg-gradient-to-l from-[#409eff] to-[#2d7ad9] text-white font-bold text-base hover:shadow-xl hover:shadow-[#409eff]/25 transition-all flex items-center justify-center gap-2.5 disabled:opacity-60 active:scale-[0.98]"
            style={{ boxShadow: '0 4px 20px rgba(64,158,255,0.3)' }}
          >
            {sharing ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
            {sharing ? t('referral.sharing') : t('common.share')}
          </button>

          {/* Share feedback */}
          {shareSuccess && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-green-400/80 text-xs"
            >
              {t('referral.shareSuccess')}
            </motion.p>
          )}
          {shareError && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-amber-400/80 text-xs"
            >
              {t('referral.shareError')}
            </motion.p>
          )}
        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative p-5 rounded-xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#409eff]/10 to-[#409eff]/3 border border-[#409eff]/15 rounded-xl" />
          <div className="relative text-center">
            <div className="p-2 rounded-xl bg-[#409eff]/15 text-[#409eff] inline-block mb-2.5">
              <Users size={18} />
            </div>
            <div className="text-3xl font-bold text-white">{referralInfo?.totalReferrals || 0}</div>
            <div className="text-white/40 text-xs mt-1">{t('referral.referralsCount')}</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative p-5 rounded-xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-emerald-500/3 border border-emerald-500/15 rounded-xl" />
          <div className="relative text-center">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 inline-block mb-2.5">
              <DollarSign size={18} />
            </div>
            <div className="text-3xl font-bold text-emerald-400">${safeFixed(referralInfo?.referralBonus, 0)}</div>
            <div className="text-white/40 text-xs mt-1">{t('referral.earnings')}</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative p-5 rounded-xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-amber-500/3 border border-amber-500/15 rounded-xl" />
          <div className="relative text-center">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 inline-block mb-2.5">
              <TrendingUp size={18} />
            </div>
            <div className="text-3xl font-bold text-amber-400">15%</div>
            <div className="text-white/40 text-xs mt-1">عمولة عند الاستثمار</div>
          </div>
        </motion.div>
      </div>

      {/* How It Works */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="p-5 rounded-xl bg-[#1f2634] border border-white/5"
      >
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <Share2 size={15} className="text-[#409eff]" />
          {t('referral.howItWorks')}
        </h3>
        <div className="space-y-3">
          {[
            { icon: <Send size={14} />, text: 'شارك كود الإحالة أو رابطك مع أصدقائك', step: '1' },
            { icon: <UserPlus size={14} />, text: 'يسجل صديقك ويفعل بريده الإلكتروني', step: '2' },
            { icon: <TrendingUp size={14} />, text: 'عندما يستثمر صديقك في أي باقة', step: '3' },
            { icon: <Gift size={14} />, text: 'تحصل على عمولة 15% من مبلغ استثماره!', step: '4' },
          ].map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
            >
              <div className="w-7 h-7 rounded-lg bg-[#409eff]/10 text-[#409eff] flex items-center justify-center flex-shrink-0 text-xs font-bold">
                {s.step}
              </div>
              <span className="text-white/60 text-sm">{s.text}</span>
            </div>
          ))}
        </div>
        {/* Commission Example */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-l from-emerald-500/[0.06] to-transparent border border-emerald-500/10">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-emerald-400" />
            <span className="text-emerald-400 font-bold text-xs">مثال على العمولة</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-white/40">إذا استثمر صديقك $1,000</span>
              <span className="text-emerald-400 font-bold">عمولتك: $150</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/40">إذا استثمر صديقك $5,000</span>
              <span className="text-emerald-400 font-bold">عمولتك: $750</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/40">إذا استثمر صديقك $10,000</span>
              <span className="text-emerald-400 font-bold">عمولتك: $1,500</span>
            </div>
          </div>
          <p className="text-white/25 text-[10px] mt-2 leading-relaxed">العمولة تُضاف تلقائياً لرصيدك القابل للسحب فور تأكيد الاستثمار</p>
        </div>
      </motion.div>

      {/* Referred Users List */}
      <div>
        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
          <UserPlus size={15} className="text-[#409eff]" />
          {t('referral.referredUsers')}
          {referralInfo && referralInfo.referrals.length > 0 && (
            <span className="text-white/30 text-xs font-normal">({referralInfo.totalReferrals})</span>
          )}
        </h3>

        {referralInfo && referralInfo.referrals.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
            {referralInfo.referrals.map((ref, i) => (
              <motion.div
                key={ref.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#1f2634] border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#409eff]/80 to-[#2d7ad9]/80 flex items-center justify-center text-white font-bold text-xs">
                    {ref.name?.charAt(0) || 'م'}
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">{ref.name}</div>
                    <div className="flex items-center gap-1 text-white/25 text-[11px]">
                      <Calendar size={9} />
                      {formatDate(ref.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                  <span className="text-emerald-400 text-xs font-semibold">15%</span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 rounded-xl bg-[#1f2634] border border-white/5">
            <div className="w-11 h-11 rounded-xl bg-[#409eff]/10 flex items-center justify-center mx-auto mb-3">
              <Users size={22} className="text-[#409eff]/60" />
            </div>
            <p className="text-white/35 text-sm mb-1">{t('referral.noReferralsYet')}</p>
            <p className="text-white/25 text-xs">{t('referral.noReferralsDesc')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
