'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  UserCircle,
  Mail,
  Phone,
  Wallet,
  TrendingUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  Calendar,
  Shield,
  Edit3,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  Camera,
  Trash2,
  Key,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';
import { safeFixed } from '@/lib/utils';

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAppStore();
  const { t, isRTL, dir } = useI18n();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/user/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: t('profile.profileUpdateSuccess') });
        setEditing(false);
        await refreshUser();
      } else {
        setMessage({ type: 'error', text: data.error || t('profile.profileUpdateError') });
      }
    } catch {
      setMessage({ type: 'error', text: t('common.serverError') });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setMessage({ type: 'error', text: t('profile.fillAllPasswordFields') });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: t('profile.newPasswordMinLength') });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setMessage({ type: 'error', text: t('profile.newPasswordMismatch') });
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch(`/api/user/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: t('profile.passwordChangedSuccess') });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setMessage({ type: 'error', text: data.error || t('profile.passwordChangeError') });
      }
    } catch {
      setMessage({ type: 'error', text: t('common.serverError') });
    } finally {
      setChangingPassword(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleChangeEmail = async () => {
    if (!user) return;
    if (!newEmail || !emailPassword) {
      setMessage({ type: 'error', text: t('profile.enterNewEmailAndPassword') });
      return;
    }
    if (!newEmail.includes('@')) {
      setMessage({ type: 'error', text: t('profile.enterValidEmail') });
      return;
    }
    setChangingEmail(true);
    try {
      const res = await fetch(`/api/user/change-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, newEmail: newEmail.trim(), password: emailPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: t('profile.emailChangedSuccess') });
        setNewEmail('');
        setEmailPassword('');
        await refreshUser();
      } else {
        setMessage({ type: 'error', text: data.error || t('common.serverError') });
      }
    } catch {
      setMessage({ type: 'error', text: t('common.serverError') });
    } finally {
      setChangingEmail(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: t('profile.selectImageFile') });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: t('profile.imageSizeLimit') });
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      formData.append('userId', user.id);

      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: t('profile.avatarUpdated') });
        await refreshUser();
      } else {
        setMessage({ type: 'error', text: data.error || t('common.serverError') });
      }
    } catch {
      setMessage({ type: 'error', text: t('common.serverError') });
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !deletePassword) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/user/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, password: deletePassword }),
      });
      const data = await res.json();
      if (res.ok) {
        logout();
      } else {
        setMessage({ type: 'error', text: data.error || t('common.serverError') });
        setShowDeleteConfirm(false);
        setDeletePassword('');
      }
    } catch {
      setMessage({ type: 'error', text: t('common.serverError') });
    } finally {
      setDeleting(false);
    }
  };

  const stats = [
    { label: t('common.balance'), value: `${safeFixed(user?.balance, 2)}`, icon: <Wallet size={18} />, color: '#409eff' },
    { label: t('profile.totalProfits'), value: `${safeFixed(user?.totalProfit, 2)}`, icon: <TrendingUp size={18} />, color: '#22c55e' },
    { label: t('profile.totalDepositedShort'), value: `${safeFixed(user?.totalDeposit, 2)}`, icon: <ArrowDownToLine size={18} />, color: '#3b82f6' },
    { label: t('profile.totalWithdrawnShort'), value: `${safeFixed(user?.totalWithdraw, 2)}`, icon: <ArrowUpFromLine size={18} />, color: '#ef4444' },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
      />

      <div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('profile.title')}</h2>
        <p className="text-white/40 text-sm">{t('profile.subtitle')}</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* Profile Card */}
      <div className="p-6 rounded-2xl bg-[#1f2634] border border-white/5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* Avatar with upload */}
            <div className="relative group">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-[#409eff] to-[#337ecc] flex items-center justify-center text-white font-bold text-2xl">
                {(user as any)?.avatar ? (
                  <img src={(user as any).avatar} alt={user?.name} className="w-full h-full object-cover" />
                ) : (
                  user?.name?.charAt(0) || 'U'
                )}
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {uploadingAvatar ? (
                  <Loader2 size={16} className="animate-spin text-white" />
                ) : (
                  <Camera size={16} className="text-white" />
                )}
              </button>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">{user?.name || t('common.noData')}</h3>
              <div className="flex items-center gap-2 text-white/40 text-sm">
                <Shield size={12} className="text-[#409eff]" />
                <span>{user?.role?.toUpperCase() === 'ADMIN' ? t('profile.admin') : t('profile.user')}</span>
                {user?.emailVerified && (
                  <CheckCircle size={10} className="text-green-400" />
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => editing ? handleSave() : setEditing(true)}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
              editing
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-white/5 text-white/40 border border-white/10 hover:text-[#409eff] hover:border-[#409eff]/20'
            }`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : editing ? <><Save size={14} /> {t('common.save')}</> : <><Edit3 size={14} /> {t('common.edit')}</>}
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div className="flex items-center gap-4">
            <UserCircle size={18} className="text-white/30 flex-shrink-0" />
            <div className="flex-1">
              <label className="text-white/40 text-xs block mb-1">{t('profile.fullName')}</label>
              {editing ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-[#409eff]/50 focus:outline-none transition-colors text-sm"
                />
              ) : (
                <span className="text-white/80 text-sm">{user?.name || '-'}</span>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center gap-4">
            <Mail size={18} className="text-white/30 flex-shrink-0" />
            <div className="flex-1">
              <label className="text-white/40 text-xs block mb-1">{t('profile.email')}</label>
              <div className="flex items-center gap-2">
                <span className="text-white/80 text-sm" dir="ltr">{user?.email || '-'}</span>
                {user?.emailVerified ? (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-green-500/10 text-green-400">{t('profile.verified')}</span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/10 text-amber-400">{t('profile.unverified')}</span>
                )}
              </div>
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-center gap-4">
            <Phone size={18} className="text-white/30 flex-shrink-0" />
            <div className="flex-1">
              <label className="text-white/40 text-xs block mb-1">{t('profile.phone')}</label>
              {editing ? (
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-[#409eff]/50 focus:outline-none transition-colors text-sm"
                  dir="ltr"
                />
              ) : (
                <span className="text-white/80 text-sm" dir="ltr">{user?.phone || t('profile.notSpecified')}</span>
              )}
            </div>
          </div>

          {/* Join Date */}
          <div className="flex items-center gap-4">
            <Calendar size={18} className="text-white/30 flex-shrink-0" />
            <div className="flex-1">
              <label className="text-white/40 text-xs block mb-1">{t('profile.joinDate')}</label>
              <span className="text-white/80 text-sm">{t('profile.activeMember')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Stats */}
      <div>
        <h3 className="text-white font-bold text-lg mb-3">{t('profile.accountSummary')}</h3>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-4 rounded-xl bg-[#1f2634] border border-white/5"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${s.color}15`, color: s.color }}>
                  {s.icon}
                </div>
                <span className="text-white/40 text-xs">{s.label}</span>
              </div>
              <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Change Email */}
      <div className="p-6 rounded-2xl bg-[#1f2634] border border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <Mail size={18} className="text-[#409eff]" />
          <h3 className="text-white font-bold text-lg">{t('profile.changeEmail')}</h3>
        </div>
        <div className="space-y-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder={t('profile.newEmail')}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[#409eff]/50 focus:outline-none transition-colors text-sm"
            dir="ltr"
          />
          <input
            type="password"
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
            placeholder={t('profile.currentPasswordToConfirm')}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[#409eff]/50 focus:outline-none transition-colors text-sm"
            dir="ltr"
          />
          <button
            onClick={handleChangeEmail}
            disabled={changingEmail || !newEmail || !emailPassword}
            className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-medium hover:bg-[#409eff]/10 hover:text-[#409eff] hover:border-[#409eff]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {changingEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            {t('profile.changeEmail')}
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="p-6 rounded-2xl bg-[#1f2634] border border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <Key size={18} className="text-[#409eff]" />
          <h3 className="text-white font-bold text-lg">{t('profile.changePassword')}</h3>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={t('profile.currentPassword')}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[#409eff]/50 focus:outline-none transition-colors text-sm"
            dir="ltr"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('profile.newPassword')}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[#409eff]/50 focus:outline-none transition-colors text-sm"
            dir="ltr"
          />
          <input
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            placeholder={t('profile.confirmNewPassword')}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[#409eff]/50 focus:outline-none transition-colors text-sm"
            dir="ltr"
          />
          <button
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || !newPassword || !confirmNewPassword}
            className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-medium hover:bg-[#409eff]/10 hover:text-[#409eff] hover:border-[#409eff]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {changingPassword ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
            {t('profile.updatePassword')}
          </button>
        </div>
      </div>

      {/* Delete Account - Danger Zone */}
      <div className="p-6 rounded-2xl bg-red-500/[0.03] border border-red-500/10">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 size={18} className="text-red-400" />
          <h3 className="text-red-400 font-bold text-lg">{t('profile.deleteAccount')}</h3>
        </div>
        <p className="text-white/30 text-sm mb-4">
          {t('profile.deleteAccountWarning')}
        </p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-6 py-2.5 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400/60 text-sm font-medium hover:bg-red-500/10 hover:text-red-400 transition-all flex items-center gap-2"
          >
            <Trash2 size={14} />
            {t('profile.deleteMyAccount')}
          </button>
        ) : (
          <div className="space-y-3">
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder={t('profile.enterPasswordToDelete')}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-red-500/20 text-white placeholder-white/30 focus:border-red-500/50 focus:outline-none transition-colors text-sm"
              dir="ltr"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || !deletePassword}
                className="px-6 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {t('profile.confirmPermanentDeletion')}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}
                className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 text-sm font-medium hover:text-white/60 transition-all"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
