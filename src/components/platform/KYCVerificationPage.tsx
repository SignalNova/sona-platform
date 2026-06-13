'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  ShieldCheck,
  Clock,
  AlertCircle,
  Upload,
  Camera,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  CreditCard,
  User,
  Loader2,
  X,
  RotateCcw,
} from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { useAppStore } from '@/lib/store';

/* ────────────────────── constants ────────────────────── */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const TOTAL_STEPS = 6;

const COUNTRIES = {
  arab: [
    { code: 'SA', nameAr: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia' },
    { code: 'AE', nameAr: 'الإمارات العربية المتحدة', nameEn: 'United Arab Emirates' },
    { code: 'KW', nameAr: 'الكويت', nameEn: 'Kuwait' },
    { code: 'BH', nameAr: 'البحرين', nameEn: 'Bahrain' },
    { code: 'QA', nameAr: 'قطر', nameEn: 'Qatar' },
    { code: 'OM', nameAr: 'عُمان', nameEn: 'Oman' },
    { code: 'EG', nameAr: 'مصر', nameEn: 'Egypt' },
    { code: 'JO', nameAr: 'الأردن', nameEn: 'Jordan' },
    { code: 'LB', nameAr: 'لبنان', nameEn: 'Lebanon' },
    { code: 'IQ', nameAr: 'العراق', nameEn: 'Iraq' },
    { code: 'SY', nameAr: 'سوريا', nameEn: 'Syria' },
    { code: 'PS', nameAr: 'فلسطين', nameEn: 'Palestine' },
    { code: 'YE', nameAr: 'اليمن', nameEn: 'Yemen' },
    { code: 'LY', nameAr: 'ليبيا', nameEn: 'Libya' },
    { code: 'TN', nameAr: 'تونس', nameEn: 'Tunisia' },
    { code: 'DZ', nameAr: 'الجزائر', nameEn: 'Algeria' },
    { code: 'MA', nameAr: 'المغرب', nameEn: 'Morocco' },
    { code: 'SD', nameAr: 'السودان', nameEn: 'Sudan' },
    { code: 'MR', nameAr: 'موريتانيا', nameEn: 'Mauritania' },
    { code: 'SO', nameAr: 'الصومال', nameEn: 'Somalia' },
    { code: 'DJ', nameAr: 'جيبوتي', nameEn: 'Djibouti' },
    { code: 'KM', nameAr: 'جزر القمر', nameEn: 'Comoros' },
  ],
  international: [
    { code: 'US', nameAr: 'الولايات المتحدة', nameEn: 'United States' },
    { code: 'GB', nameAr: 'المملكة المتحدة', nameEn: 'United Kingdom' },
    { code: 'DE', nameAr: 'ألمانيا', nameEn: 'Germany' },
    { code: 'FR', nameAr: 'فرنسا', nameEn: 'France' },
    { code: 'TR', nameAr: 'تركيا', nameEn: 'Turkey' },
    { code: 'MY', nameAr: 'ماليزيا', nameEn: 'Malaysia' },
    { code: 'ID', nameAr: 'إندونيسيا', nameEn: 'Indonesia' },
    { code: 'PK', nameAr: 'باكستان', nameEn: 'Pakistan' },
    { code: 'IN', nameAr: 'الهند', nameEn: 'India' },
    { code: 'BD', nameAr: 'بنغلاديش', nameEn: 'Bangladesh' },
    { code: 'NG', nameAr: 'نيجيريا', nameEn: 'Nigeria' },
    { code: 'ZA', nameAr: 'جنوب أفريقيا', nameEn: 'South Africa' },
    { code: 'BR', nameAr: 'البرازيل', nameEn: 'Brazil' },
    { code: 'RU', nameAr: 'روسيا', nameEn: 'Russia' },
    { code: 'CN', nameAr: 'الصين', nameEn: 'China' },
    { code: 'JP', nameAr: 'اليابان', nameEn: 'Japan' },
    { code: 'KR', nameAr: 'كوريا الجنوبية', nameEn: 'South Korea' },
    { code: 'OTHER', nameAr: 'دولة أخرى', nameEn: 'Other' },
  ],
};

const DOC_TYPES = [
  { value: 'passport', icon: Globe, color: '#409eff' },
  { value: 'national_id', icon: CreditCard, color: '#04cf99' },
  { value: 'driver_license', icon: FileText, color: '#f59e0b' },
  { value: 'residence_permit', icon: Shield, color: '#a78bfa' },
] as const;

/* ────────────────────── helper: file → preview URL ────────────────────── */

function fileToPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ────────────────────── sub-components ────────────────────── */

/** Step indicator icon in the progress bar */
function StepIcon({ step, currentStep }: { step: number; currentStep: number }) {
  const icons = [Globe, FileText, Upload, Upload, Camera, CheckCircle];
  const Icon = icons[step - 1];
  const done = step < currentStep;
  const active = step === currentStep;

  return (
    <div
      className={`flex items-center justify-center w-9 h-9 rounded-full transition-all duration-300 ${
        done
          ? 'bg-[#04cf99] text-white'
          : active
            ? 'bg-[#409eff] text-white ring-4 ring-[#409eff]/20'
            : 'bg-white/5 text-white/30'
      }`}
    >
      {done ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
    </div>
  );
}

/** Connecting line between step circles */
function StepLine({ done }: { done: boolean }) {
  return (
    <div className="flex-1 h-0.5 mx-1 rounded-full transition-all duration-500 bg-white/10 relative overflow-hidden">
      <motion.div
        className="absolute inset-y-0 left-0 bg-[#04cf99] rounded-full"
        initial={{ width: '0%' }}
        animate={{ width: done ? '100%' : '0%' }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      />
    </div>
  );
}

/** Reusable file-upload area with drag-and-drop & camera */
function ImageUploadArea({
  label,
  previewUrl,
  onFileSelect,
  onRemove,
  t,
  isRTL,
  showCamera = false,
}: {
  label: string;
  previewUrl: string | null;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  t: (k: string) => string;
  isRTL: boolean;
  showCamera?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraError, setCameraError] = useState('');

  /* ── drag handlers ── */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSelect(file);
  };

  /* ── file validation ── */
  const validateAndSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert(t('kyc.invalidFileType'));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert(t('kyc.fileTooLarge'));
      return;
    }
    onFileSelect(file);
  };

  /* ── camera ── */
  const openCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setCameraStream(stream);
      setCameraOpen(true);
      // Wait for next tick so video element is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch {
      setCameraError(t('kyc.cameraError'));
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
          onFileSelect(file);
          closeCamera();
        }
      },
      'image/jpeg',
      0.9
    );
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
    setCameraOpen(false);
  };

  /* ── cleanup ── */
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cameraOpen) {
    return (
      <div className="relative rounded-xl overflow-hidden bg-black">
        <video ref={videoRef} autoPlay playsInline className="w-full max-h-80 object-contain" />
        <canvas ref={canvasRef} className="hidden" />
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-[#f36464] text-sm p-4 text-center">
            {cameraError}
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={closeCamera}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition"
          >
            <X className="w-4 h-4" />
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={capturePhoto}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-[#409eff] text-white text-sm font-semibold hover:bg-[#3a8ee6] transition"
          >
            <Camera className="w-4 h-4" />
            {t('kyc.takePhoto')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-white/70 text-sm font-medium">{label}</label>

      {previewUrl ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative rounded-xl overflow-hidden border border-[#04cf99]/30 bg-[#04cf99]/5"
        >
          <img src={previewUrl} alt="Preview" className="w-full max-h-64 object-contain" />
          <div className="absolute top-2 right-2 flex gap-2">
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 rounded-lg bg-[#f36464]/90 text-white hover:bg-[#f36464] transition"
              title={t('kyc.removeImage')}
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition"
              title={t('kyc.removeImage')}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-center gap-1.5 py-2 text-[#04cf99] text-xs font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            {t('kyc.imageUploaded')}
          </div>
        </motion.div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
            dragging
              ? 'border-[#409eff] bg-[#409eff]/10'
              : 'border-white/10 hover:border-[#409eff]/40 hover:bg-white/[0.02]'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) validateAndSelect(file);
              e.target.value = '';
            }}
          />
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
              <Upload className="w-6 h-6 text-[#409eff]" />
            </div>
            <div>
              <p className="text-white/60 text-sm">{t('kyc.dragDrop')}</p>
              <p className="text-white/30 text-xs mt-1">{t('kyc.fileSize')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Camera button */}
      {showCamera && !previewUrl && (
        <button
          type="button"
          onClick={openCamera}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 bg-white/5 text-white/70 text-sm hover:bg-white/10 hover:text-white transition"
        >
          <Camera className="w-4 h-4" />
          {t('kyc.capturePhoto')}
        </button>
      )}
    </div>
  );
}

/* ────────────────────── main component ────────────────────── */

export function KYCVerificationPage() {
  const { t, isRTL } = useI18n();
  const { user } = useAppStore();

  /* ── KYC status from server ── */
  const [kycData, setKycData] = useState<{
    kycStatus: string;
    kycFullName: string | null;
    kycIdNumber: string | null;
    kycDocumentType: string | null;
    kycSubmittedAt: string | null;
    kycVerifiedAt: string | null;
    kycRejectReason: string | null;
    kycCountry: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  /* ── wizard state ── */
  const [step, setStep] = useState(1);
  const [country, setCountry] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [fullName, setFullName] = useState(user?.name || '');
  const [idNumber, setIdNumber] = useState('');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [direction, setDirection] = useState(0);

  /* ── fetch KYC status ── */
  useEffect(() => {
    fetch('/api/kyc/status')
      .then((res) => res.json())
      .then((data) => setKycData(data.kyc || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* ── file preview generation ── */
  const handleFileSelect = async (
    file: File,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => {
    setFile(file);
    const preview = await fileToPreview(file);
    setPreview(preview);
  };

  /* ── navigation ── */
  const canNext = (): boolean => {
    switch (step) {
      case 1:
        return !!country;
      case 2:
        return !!documentType;
      case 3:
        return !!frontFile;
      case 4:
        return !!backFile;
      case 5:
        return !!selfieFile;
      default:
        return true;
    }
  };

  const goNext = () => {
    if (canNext() && step < TOTAL_STEPS) setStep((s) => s + 1);
  };
  const goBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  /* ── submit ── */
  const handleSubmit = async () => {
    if (!fullName || !idNumber || !documentType || !frontFile || !selfieFile) {
      setSubmitError(t('kyc.requiredField'));
      return;
    }
    setSubmitting(true);
    setSubmitError('');

    try {
      const formData = new FormData();
      formData.append('fullName', fullName);
      formData.append('idNumber', idNumber);
      formData.append('documentType', documentType);
      formData.append('country', country);
      formData.append('frontImage', frontFile);
      if (backFile) formData.append('backImage', backFile);
      formData.append('selfieImage', selfieFile);

      const res = await fetch('/api/kyc/submit', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitSuccess(true);
        setKycData({
          kycStatus: 'PENDING',
          kycFullName: fullName,
          kycIdNumber: idNumber,
          kycDocumentType: documentType,
          kycSubmittedAt: new Date().toISOString(),
          kycVerifiedAt: null,
          kycRejectReason: null,
          kycCountry: country,
        });
      } else {
        setSubmitError(data.error || t('common.error'));
      }
    } catch {
      setSubmitError(t('common.serverError'));
    }
    setSubmitting(false);
  };

  /* ── loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#409eff] animate-spin" />
      </div>
    );
  }

  /* ── status card config ── */
  const statusConfig: Record<string, { label: string; desc: string; color: string; icon: React.ReactNode }> = {
    VERIFIED: {
      label: t('kyc.verifiedStatus'),
      desc: t('kyc.approved'),
      color: 'border-[#04cf99]/40 bg-[#04cf99]/5',
      icon: <ShieldCheck className="w-8 h-8 text-[#04cf99]" />,
    },
    PENDING: {
      label: t('kyc.pendingStatus'),
      desc: t('kyc.reviewTime'),
      color: 'border-yellow-500/40 bg-yellow-500/5',
      icon: <Clock className="w-8 h-8 text-yellow-500" />,
    },
    REJECTED: {
      label: t('kyc.rejectedStatus'),
      desc: t('kyc.resubmit'),
      color: 'border-[#f36464]/40 bg-[#f36464]/5',
      icon: <AlertCircle className="w-8 h-8 text-[#f36464]" />,
    },
    NONE: {
      label: t('kyc.noneStatus'),
      desc: t('kyc.subtitle'),
      color: 'border-white/10 bg-white/[0.02]',
      icon: <Shield className="w-8 h-8 text-white/40" />,
    },
  };

  const currentStatus = statusConfig[kycData?.kycStatus || 'NONE'];
  const showWizard = !kycData || kycData.kycStatus === 'NONE' || kycData.kycStatus === 'REJECTED';

  /* ── animation variants ── */
  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  };

  const goNextAnimated = () => {
    setDirection(1);
    goNext();
  };
  const goBackAnimated = () => {
    setDirection(-1);
    goBack();
  };

  /* ── document type label helper ── */
  const docTypeLabel = (value: string) => {
    const map: Record<string, string> = {
      passport: t('kyc.passport'),
      national_id: t('kyc.nationalId'),
      driver_license: t('kyc.driverLicense'),
      residence_permit: t('kyc.residencePermit'),
    };
    return map[value] || value;
  };

  const countryLabel = (code: string) => {
    const all = [...COUNTRIES.arab, ...COUNTRIES.international];
    const found = all.find((c) => c.code === code);
    if (!found) return code;
    return isRTL ? found.nameAr : found.nameEn;
  };

  /* ────────────────── RENDER ────────────────── */

  return (
    <div className="min-h-screen bg-[#030708] text-white" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#409eff]/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#409eff]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t('kyc.title')}</h1>
            <p className="text-white/40 text-sm">{t('kyc.subtitle')}</p>
          </div>
        </div>

        {/* ── Status Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl border p-5 mb-6 ${currentStatus.color}`}
        >
          <div className="flex items-center gap-4">
            {currentStatus.icon}
            <div className="flex-1">
              <div className="text-lg font-bold">{currentStatus.label}</div>
              <div className="text-sm text-white/60">{currentStatus.desc}</div>
            </div>
          </div>
          {kycData?.kycSubmittedAt && (
            <div className="mt-3 text-xs text-white/40">
              {t('kyc.submittedDate')}: {new Date(kycData.kycSubmittedAt).toLocaleDateString(isRTL ? 'ar' : 'en')}
            </div>
          )}
          {kycData?.kycVerifiedAt && (
            <div className="mt-1 text-xs text-white/40">
              {t('kyc.verifiedDate')}: {new Date(kycData.kycVerifiedAt).toLocaleDateString(isRTL ? 'ar' : 'en')}
            </div>
          )}
          {kycData?.kycRejectReason && (
            <div className="mt-3 text-sm text-[#f36464]">
              {t('kyc.rejectReason')}: {kycData.kycRejectReason}
            </div>
          )}
        </motion.div>

        {/* ── Wizard ── */}
        {showWizard && (
          <>
            {/* ── Progress Bar ── */}
            <div className="mb-8">
              {/* Step counter */}
              <div className="text-center text-xs text-white/40 mb-4">
                {t('kyc.stepOf', { current: step, total: TOTAL_STEPS })}
              </div>
              {/* Step circles and lines */}
              <div className="flex items-center">
                {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s, idx) => (
                  <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <StepIcon step={s} currentStep={step} />
                      <span
                        className={`text-[10px] leading-tight text-center whitespace-nowrap ${
                          s <= step ? 'text-white/60' : 'text-white/20'
                        }`}
                      >
                        {t(`kyc.step${s}Title`)}
                      </span>
                    </div>
                    {idx < TOTAL_STEPS - 1 && <StepLine done={s < step} />}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Step Content ── */}
            <div className="bg-[#1f2634] rounded-2xl border border-white/[0.06] overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                {/* ── STEP 1: Country ── */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="p-6"
                  >
                    <h2 className="text-lg font-bold mb-1">{t('kyc.step1Title')}</h2>
                    <p className="text-white/40 text-sm mb-6">{t('kyc.step1Desc')}</p>

                    {/* Arab countries */}
                    <div className="mb-5">
                      <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
                        {t('kyc.arabCountries')}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                        {COUNTRIES.arab.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => setCountry(c.code)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all duration-200 ${
                              country === c.code
                                ? 'border-[#409eff] bg-[#409eff]/10 text-[#409eff]'
                                : 'border-white/5 bg-white/[0.02] text-white/70 hover:border-white/20 hover:bg-white/[0.04]'
                            }`}
                          >
                            <Globe className="w-4 h-4 shrink-0" />
                            <span>{isRTL ? c.nameAr : c.nameEn}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* International countries */}
                    <div>
                      <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
                        {t('kyc.internationalCountries')}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                        {COUNTRIES.international.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => setCountry(c.code)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all duration-200 ${
                              country === c.code
                                ? 'border-[#409eff] bg-[#409eff]/10 text-[#409eff]'
                                : 'border-white/5 bg-white/[0.02] text-white/70 hover:border-white/20 hover:bg-white/[0.04]'
                            }`}
                          >
                            <Globe className="w-4 h-4 shrink-0" />
                            <span>{isRTL ? c.nameAr : c.nameEn}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── STEP 2: Document Type ── */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="p-6"
                  >
                    <h2 className="text-lg font-bold mb-1">{t('kyc.step2Title')}</h2>
                    <p className="text-white/40 text-sm mb-6">{t('kyc.step2Desc')}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {DOC_TYPES.map((doc) => {
                        const Icon = doc.icon;
                        const selected = documentType === doc.value;
                        return (
                          <button
                            key={doc.value}
                            type="button"
                            onClick={() => setDocumentType(doc.value)}
                            className={`flex flex-col items-center gap-3 p-6 rounded-xl border transition-all duration-200 ${
                              selected
                                ? 'border-[#409eff] bg-[#409eff]/10'
                                : 'border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                            }`}
                          >
                            <div
                              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                                selected ? 'bg-[#409eff]/20' : 'bg-white/5'
                              }`}
                            >
                              <Icon
                                className="w-6 h-6 transition-colors"
                                style={{ color: selected ? doc.color : 'rgba(255,255,255,0.4)' }}
                              />
                            </div>
                            <div className="text-center">
                              <div className={`text-sm font-semibold ${selected ? 'text-[#409eff]' : 'text-white/70'}`}>
                                {t(`kyc.${doc.value === 'national_id' ? 'nationalId' : doc.value === 'driver_license' ? 'driverLicense' : doc.value === 'residence_permit' ? 'residencePermit' : 'passport'}`)}
                              </div>
                              <div className="text-xs text-white/30 mt-0.5">
                                {t(`kyc.${doc.value === 'national_id' ? 'nationalIdDesc' : doc.value === 'driver_license' ? 'driverLicenseDesc' : doc.value === 'residence_permit' ? 'residencePermitDesc' : 'passportDesc'}`)}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* ── STEP 3: Front Image ── */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="p-6"
                  >
                    <h2 className="text-lg font-bold mb-1">{t('kyc.step3Title')}</h2>
                    <p className="text-white/40 text-sm mb-6">{t('kyc.step3Desc')}</p>

                    <ImageUploadArea
                      label={t('kyc.frontImage')}
                      previewUrl={frontPreview}
                      onFileSelect={(f) => handleFileSelect(f, setFrontFile, setFrontPreview)}
                      onRemove={() => {
                        setFrontFile(null);
                        setFrontPreview(null);
                      }}
                      t={t}
                      isRTL={isRTL}
                      showCamera
                    />

                    {/* Tips */}
                    <div className="mt-6 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <p className="text-xs font-semibold text-white/50 mb-2">{t('kyc.tips')}</p>
                      <ul className="space-y-1.5">
                        {[1, 2, 3, 4].map((n) => (
                          <li key={n} className="flex items-start gap-2 text-xs text-white/30">
                            <CheckCircle className="w-3.5 h-3.5 text-[#04cf99] shrink-0 mt-0.5" />
                            {t(`kyc.tip${n}`)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}

                {/* ── STEP 4: Back Image ── */}
                {step === 4 && (
                  <motion.div
                    key="step4"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="p-6"
                  >
                    <h2 className="text-lg font-bold mb-1">{t('kyc.step4Title')}</h2>
                    <p className="text-white/40 text-sm mb-6">{t('kyc.step4Desc')}</p>

                    <ImageUploadArea
                      label={t('kyc.backImage')}
                      previewUrl={backPreview}
                      onFileSelect={(f) => handleFileSelect(f, setBackFile, setBackPreview)}
                      onRemove={() => {
                        setBackFile(null);
                        setBackPreview(null);
                      }}
                      t={t}
                      isRTL={isRTL}
                      showCamera
                    />
                  </motion.div>
                )}

                {/* ── STEP 5: Selfie ── */}
                {step === 5 && (
                  <motion.div
                    key="step5"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="p-6"
                  >
                    <h2 className="text-lg font-bold mb-1">{t('kyc.step5Title')}</h2>
                    <p className="text-white/40 text-sm mb-2">{t('kyc.step5Desc')}</p>
                    <p className="text-white/30 text-xs mb-6">{t('kyc.selfieInstructions')}</p>

                    <ImageUploadArea
                      label={t('kyc.selfieImage')}
                      previewUrl={selfiePreview}
                      onFileSelect={(f) => handleFileSelect(f, setSelfieFile, setSelfiePreview)}
                      onRemove={() => {
                        setSelfieFile(null);
                        setSelfiePreview(null);
                      }}
                      t={t}
                      isRTL={isRTL}
                      showCamera
                    />
                  </motion.div>
                )}

                {/* ── STEP 6: Review & Submit ── */}
                {step === 6 && (
                  <motion.div
                    key="step6"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="p-6"
                  >
                    <h2 className="text-lg font-bold mb-1">{t('kyc.step6Title')}</h2>
                    <p className="text-white/40 text-sm mb-6">{t('kyc.step6Desc')}</p>

                    {/* Full name & ID inputs */}
                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-white/70 text-sm font-medium mb-1.5">
                          {t('kyc.fullNameLabel')}
                        </label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder={t('kyc.fullNamePlaceholder')}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#409eff] focus:outline-none focus:ring-2 focus:ring-[#409eff]/20 transition placeholder:text-white/20"
                        />
                      </div>
                      <div>
                        <label className="block text-white/70 text-sm font-medium mb-1.5">
                          {t('kyc.idNumberLabel')}
                        </label>
                        <input
                          type="text"
                          value={idNumber}
                          onChange={(e) => setIdNumber(e.target.value)}
                          placeholder={t('kyc.idNumberPlaceholder')}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#409eff] focus:outline-none focus:ring-2 focus:ring-[#409eff]/20 transition placeholder:text-white/20"
                        />
                      </div>
                    </div>

                    {/* Summary card */}
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/5">
                      {/* Country */}
                      <div className="flex items-center gap-3 p-4">
                        <Globe className="w-5 h-5 text-[#409eff] shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-white/40">{t('kyc.countryLabel')}</div>
                          <div className="text-sm text-white/80">{countryLabel(country)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setStep(1); setDirection(-1); }}
                          className="text-xs text-[#409eff] hover:underline"
                        >
                          {t('kyc.backToAddMore')}
                        </button>
                      </div>
                      {/* Document type */}
                      <div className="flex items-center gap-3 p-4">
                        <FileText className="w-5 h-5 text-[#04cf99] shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-white/40">{t('kyc.documentTypeLabel')}</div>
                          <div className="text-sm text-white/80">{docTypeLabel(documentType)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setStep(2); setDirection(-1); }}
                          className="text-xs text-[#409eff] hover:underline"
                        >
                          {t('kyc.backToAddMore')}
                        </button>
                      </div>
                      {/* Front image */}
                      <div className="flex items-center gap-3 p-4">
                        <Upload className="w-5 h-5 text-[#409eff] shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-white/40">{t('kyc.frontImageLabel')}</div>
                          <div className="text-sm text-[#04cf99] flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            {t('kyc.provided')}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setStep(3); setDirection(-1); }}
                          className="text-xs text-[#409eff] hover:underline"
                        >
                          {t('kyc.backToAddMore')}
                        </button>
                      </div>
                      {/* Back image */}
                      <div className="flex items-center gap-3 p-4">
                        <Upload className="w-5 h-5 text-[#04cf99] shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-white/40">{t('kyc.backImageLabel')}</div>
                          {backFile ? (
                            <div className="text-sm text-[#04cf99] flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {t('kyc.provided')}
                            </div>
                          ) : (
                            <div className="text-sm text-white/30">{t('kyc.notProvided')}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => { setStep(4); setDirection(-1); }}
                          className="text-xs text-[#409eff] hover:underline"
                        >
                          {t('kyc.backToAddMore')}
                        </button>
                      </div>
                      {/* Selfie */}
                      <div className="flex items-center gap-3 p-4">
                        <User className="w-5 h-5 text-[#a78bfa] shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-white/40">{t('kyc.selfieImageLabel')}</div>
                          <div className="text-sm text-[#04cf99] flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            {t('kyc.provided')}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setStep(5); setDirection(-1); }}
                          className="text-xs text-[#409eff] hover:underline"
                        >
                          {t('kyc.backToAddMore')}
                        </button>
                      </div>
                    </div>

                    {/* Error message */}
                    {submitError && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-3 rounded-xl bg-[#f36464]/10 border border-[#f36464]/30 text-[#f36464] text-sm flex items-center gap-2"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {submitError}
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Navigation Buttons ── */}
              {!submitSuccess && (
                <div className="flex items-center justify-between p-4 border-t border-white/5 bg-[#1f2634]/80">
                  <button
                    type="button"
                    onClick={goBackAnimated}
                    disabled={step === 1}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      step === 1
                        ? 'opacity-0 pointer-events-none'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    {t('common.back')}
                  </button>

                  {step < TOTAL_STEPS ? (
                    <button
                      type="button"
                      onClick={goNextAnimated}
                      disabled={!canNext()}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all bg-[#409eff] text-white hover:bg-[#3a8ee6] disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {t('common.next')}
                      {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting || !fullName || !idNumber}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all bg-[#04cf99] text-black hover:bg-[#03b888] disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t('kyc.submitting')}
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          {t('kyc.submitConfirm')}
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Success overlay ── */}
            <AnimatePresence>
              {submitSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 p-8 rounded-2xl bg-[#1f2634] border border-[#04cf99]/20 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
                    className="w-16 h-16 rounded-full bg-[#04cf99]/10 flex items-center justify-center mx-auto mb-4"
                  >
                    <CheckCircle className="w-8 h-8 text-[#04cf99]" />
                  </motion.div>
                  <h3 className="text-lg font-bold text-white mb-2">{t('kyc.submitSuccess')}</h3>
                  <p className="text-white/40 text-sm">{t('kyc.reviewTime')}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* ── Custom scrollbar styles ── */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
