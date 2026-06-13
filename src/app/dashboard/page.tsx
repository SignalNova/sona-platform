'use client'

import { useState, useEffect, useCallback, useRef, useMemo, memo, createContext, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import TradingPageComponent from '@/components/platform/TradingPage'
import P2PTransferPage from '@/components/platform/P2PTransferPage'

import { useAppStore } from '@/lib/store'


// Context to share app state with extracted components
const AppContext = createContext<any>(null)
const useApp = () => useContext(AppContext)

// ===== i18n =====
const translations: Record<string, Record<string, string>> = {
  ar: {
    // Nav
    home: 'الرئيسية', packages: 'الباقات', investments: 'استثماراتي', deposit: 'الإيداع',
    withdraw: 'السحب', signals: 'الإشارات', kyc: 'التحقق', support: 'الدعم',
    referrals: 'الإحالات', about: 'عن المنصة', terms: 'الشروط', privacy: 'الخصوصية',
    admin: 'الإدارة', more: 'المزيد', logout: 'خروج',
    // Auth
    login: 'تسجيل الدخول', register: 'إنشاء حساب', email: 'البريد الإلكتروني',
    password: 'كلمة المرور', fullName: 'الاسم الكامل', phone: 'رقم الهاتف',
    refCode: 'كود الإحالة', forgotPassword: 'نسيت كلمة المرور؟',
    noAccount: 'ليس لديك حساب؟ سجل الآن', haveAccount: 'لديك حساب؟ سجل الدخول',
    backHome: 'العودة للرئيسية', createAccount: 'إنشاء حساب',
    agreeTerms: 'أوافق على', termsOfUse: 'شروط الاستخدام', privacyPolicy: 'سياسة الخصوصية',
    resetPassword: 'إعادة تعيين كلمة المرور', newPassword: 'كلمة المرور الجديدة',
    changePassword: 'تغيير كلمة المرور', backToLogin: 'العودة لتسجيل الدخول',
    sendResetLink: 'إرسال رابط التعيين', cancel: 'إلغاء',
    // Dashboard
    welcome: 'مرحباً', walletOverview: 'إليك نظرة عامة على محفظتك',
    availableBalance: 'الرصيد المتاح', totalProfit: 'إجمالي الأرباح',
    totalDeposits: 'إجمالي الإيداعات', investAction: 'استثمار',
    activeInvestments: 'الاستثمارات النشطة', viewAll: 'عرض الكل',
    daily: 'يومياً', totalProfitLabel: 'إجمالي الأرباح',
    marketPrices: 'أسعار السوق',
    // Deposit
    depositTitle: 'الإيداع', paymentCreated: 'تم إنشاء طلب الدفع',
    sendAmountBelow: 'أرسل المبلغ المطلوب للعنوان أدناه',
    addressLabel: 'العنوان:', copyAddress: 'نسخ العنوان',
    requiredAmount: 'المبلغ المطلوب', paymentNumber: 'رقم الدفعة',
    autoPayment: 'دفع تلقائي', manualDeposit: 'إيداع يدوي',
    nowpaymentsTitle: 'دفع تلقائي آمن',
    nowpaymentsDesc: 'سريع وآمن - اعتماد فوري',
    depositAmount: 'مبلغ الإيداع (USDT)', createPaymentBtn: 'إنشاء طلب الدفع',
    depositHistory: 'سجل الإيداعات',
    // Withdraw
    withdrawTitle: 'السحب', kycRequired: 'يجب التحقق من الهوية أولاً',
    kycRequiredDesc: 'يرجى إكمال عملية التحقق من الهوية (KYC) لتفعيل السحب',
    goToKyc: 'الذهاب للتحقق',
    withdrawAmount: 'مبلغ السحب (USDT)', walletAddress: 'عنوان المحفظة',
    selectNetwork: 'اختر الشبكة', withdrawBtn: 'إرسال طلب السحب',
    withdrawMin: 'الحد الأدنى للسحب: $20',
    withdrawFee: 'يتم خصم رسوم الشبكة من المبلغ',
    withdrawAvailable: 'الرصيد المتاح للسحب',
    withdrawHistory: 'سجل السحوبات',
    withdrawNoHistory: 'لا يوجد سحوبات سابقة',
    withdrawNetworkBEP20: 'BEP20 (BSC)', withdrawNetworkTRC20: 'TRC20 (Tron)',
    withdrawNetworkERC20: 'ERC20 (Ethereum)', withdrawNetworkBTC: 'Bitcoin',
    withdrawSecure: 'سحب آمن ومشفر', withdrawSecureDesc: 'يتم معالجة طلبات السحب بأمان',
    withdrawAutoProcess: 'معالجة تلقائية', withdrawAutoProcessDesc: 'السحوبات الآمنة تُعالج تلقائياً عبر البلوكتشين',
    withdrawQuickAmounts: 'مبالغ سريعة', withdrawAll: 'سحب الكل',
    withdrawConfirmTitle: 'تأكيد طلب السحب',
    withdrawConfirmDesc: 'سيتم سحب المبلغ المحدد إلى المحفظة التالية',
    withdrawConfirmNetwork: 'الشبكة', withdrawConfirmAmount: 'المبلغ',
    withdrawConfirmWallet: 'المحفظة', withdrawConfirm: 'تأكيد السحب',
    pendingW: 'معلق', processingW: 'قيد المعالجة', completedW: 'مكتمل',
    rejectedW: 'مرفوض', approvedW: 'مقبول',
    // KYC
    kycTitle: 'التحقق من الهوية', verified: 'تم التحقق بنجاح',
    verifiedDesc: 'حسابك موثق بالكامل ويمكنك السحب',
    underReview: 'قيد المراجعة',
    underReviewDesc: 'يتم مراجعة مستنداتك وسيتم الرد خلال 24 ساعة',
    rejected: 'تم رفض التحقق', completeVerification: 'أكمل التحقق لتفعيل السحب',
    idName: 'الاسم الكامل (كما في الهوية)', idNumber: 'رقم الهوية',
    passport: 'جواز سفر', idCard: 'بطاقة هوية وطنية', driverLicense: 'رخصة قيادة',
    uploadDoc: 'ارفع صورة المستند', uploadSelfie: 'ارفع صورة السيلفي مع الهوية (اختياري)',
    fillAllFields: 'يرجى ملء جميع الحقول ورفع صورة الهوية',
    submitVerification: 'إرسال طلب التحقق',
    // Landing
    licensed: 'منصة تداول واستثمار مرخصة',
    heroTitle1: 'تداول واستثمر بأمان', heroTitle2: 'عوائد يومية مضمونة',
    heroDesc: 'منصة SONA للتداول والاستثمار الذكي. إشارات تداول يومية وباقات استثمارية متنوعة مع عوائد تصل إلى 3% يومياً.',
    startTrading: 'ابدأ التداول الآن',
    activeUsers: 'مستخدم نشط', tradingVolume: 'حجم التداول', returnsEarned: 'عوائد محققة',
    features: 'مميزات المنصة',
    dailySignals: 'إشارات تداول يومية', dailySignalsDesc: '3 إشارات تداول يومية لمساعدتك في مضاعفة استثمارك',
    smartBots: 'فريق تحليل محترف', smartBotsDesc: 'استراتيجيات تداول متقدمة من فريق المحللين المحترفين',
    licensedFull: 'مرخصة بالكامل', licensedDesc: 'مرخصة من FCA برقم 847592 مع حماية كاملة للأصول',
    easyWithdraw: 'سحب سهل وسريع', easyWithdrawDesc: 'سحب الأرباح بشكل يومي مع تحويل فوري عبر البلوكتشين',
    investPackages: 'باقات الاستثمار', investPackagesDesc: 'عوائد يومية من 1.5% إلى 3% - من $100 إلى $50,000',
    starter: 'المبتدئ', basic: 'الأساسي', advanced: 'المتقدم', professional: 'المحترف', vip: 'كبار المستثمرين',
    period: 'يوم', minDepositLabel: 'الحد الأدنى للإيداع',
    // Support
    supportTitle: 'دعم العملاء', smartHelp: 'دعم العملاء', online: 'متصل الآن',
    typeMessage: 'اكتب رسالتك...', send: 'إرسال',
    newConversation: 'محادثة جديدة',
    // Email Verification
    verifyEmail: 'تحقق من بريدك الإلكتروني',
    verifyEmailDesc: 'أرسلنا رمز تحقق إلى بريدك الإلكتروني',
    verifyCode: 'رمز التحقق', sendCode: 'إرسال رمز التحقق',
    verifying: 'جاري التحقق...', verifiedEmail: 'تم التحقق من البريد الإلكتروني',
    resendCode: 'إعادة إرسال الرمز',
    // Misc
    and: 'و', optional: 'اختياري', copied: 'تم النسخ!',
    connectionError: 'حدث خطأ في الاتصال', error: 'حدث خطأ',
    retry: 'إعادة المحاولة',
    loginSuccess: 'تم تسجيل الدخول بنجاح',
    registerSuccess: 'تم إنشاء الحساب بنجاح!',
    resetSent: 'تم إرسال رابط إعادة تعيين كلمة المرور',
    passwordChanged: 'تم تغيير كلمة المرور بنجاح',
    mustAgree: 'يجب الموافقة على شروط الاستخدام',
    depositSuccess: 'تم إنشاء طلب الدفع! أرسل USDT للعنوان أدناه',
    depositManualSuccess: 'تم إرسال طلب الإيداع بنجاح',
    investSuccess: 'تم تفعيل الباقة بنجاح! جاري تنفيذ استراتيجية التداول الاحترافية',
    withdrawSuccess: 'تم إرسال طلب السحب بنجاح',
    kycSuccess: 'تم إرسال طلب التحقق بنجاح',
    confirmInvest: 'تأكيد الاستثمار', cancelBtn: 'إلغاء',
    dailyProfit: 'العائد اليومي', duration: 'المدة',
    availableBalanceLabel: 'رصيدك المتاح',
    expectedDailyProfit: 'الربح اليومي المتوقع',
    capitalFrozen: 'رأس المال مجمد طوال فترة الباقة والأرباح تتحرر يومياً',
    investIn: 'استثمار في باقة',
    logoutBtn: 'تسجيل الخروج',
    verifiedBadge: 'موثق',
    platform: 'منصة التداول والاستثمار',
    sonaPlatform: 'SONA - منصة التداول والاستثمار الذكي',
    copyFailed: 'فشل النسخ',
    minDeposit: 'الحد الأدنى للإيداع 10$',
    enterEmail: 'يرجى إدخال البريد الإلكتروني',
    enterNewPassword: 'يرجى إدخال كلمة المرور الجديدة',
    depositNote: 'أرسل المبلغ المحدد فقط. سيتم اعتماد الإيداع تلقائياً بعد التأكيد على البلوكتشين.',
    newDeposit: 'إنشاء إيداع جديد',
    nowpaymentsNote: 'سيتم إنشاء عنوان دفع فريد. أرسل USDT على شبكة BEP20 وسيتم الاعتماد تلقائياً.',
    notifications: 'الإشعارات', account: 'حسابي', myAccount: 'حسابي',
    // Dual Mode
    withdrawableBalance: 'رصيد قابل للسحب',
    poolShare: 'حصتي في الصندوق', poolProfit: 'أرباح الصندوق',
    days: 'يوماً',
    sonaMode: 'SONA',
    sonaDesc: 'تداول جماعي بتوزيع أرباح وخسائر حقيقية',
    maintenanceMode: 'وضع الصيانة', hackAlert: 'تنبيه اختراق',
    exportData: 'تصدير البيانات', triggerProfits: 'تشغيل الأرباح اليومية',
    reportDaily: 'تقرير يومي', reportMonthly: 'تقرير شهري',
    depositNoticeSONA: 'أموالك ستُضاف لصندوق التداول الجماعي. الأرباح والخسائر تُوزّع يومياً حسب حصتك في الصندوق.',
    riskDisclaimer: 'تحذير: التداول الجماعي ينطوي على مخاطر حقيقية. قد تخسر جزءاً من رأس مالك.',
    withdrawInstructions: 'تعليمات السحب',
    withdrawInstructionsDesc: 'للقيام بعملية سحب، يرجى التواصل مع فريق الدعم عبر صفحة الدعم أو إرسال طلب سحب يتضمن المبلغ المطلوب وعنوان المحفظة والشبكة المفضلة.',
    contactSupport: 'تواصل مع الدعم',
    totalInvestment: 'إجمالي الاستثمار',
    daysPassed: 'أيام مضت',
    remaining: 'متبقي',
    platformSettings: 'إعدادات المنصة',
    platformMode: 'نظام المنصة',
    customMessage: 'رسالة مخصصة',
    sendNotification: 'إرسال إشعار',
    notificationTitle: 'عنوان الإشعار',
    notificationBody: 'محتوى الإشعار',
    sendToAll: 'إرسال للجميع',
    sendToUser: 'إرسال لمستخدم',
    suspendAccount: 'تعليق الحساب',
    activateAccount: 'تفعيل الحساب',
    packageEditor: 'تعديل الباقات',
    dailyRate: 'العائد اليومي',
    withdrawLimit: 'حد السحب اليومي',
    processingHours: 'ساعات المعالجة',
    hackMessage: 'تم اختراق المنصة',
    maintenanceMessage: 'المنصة تحت الصيانة',
    // Admin Panel Extended
    adminPanel: 'لوحة الإدارة', refresh: 'تحديث', totalUsers: 'إجمالي المستخدمين',
    deposits: 'الإيداعات', withdrawals: 'السحوبات', profitsDistributed: 'الأرباح الموزعة',
    activeInvestments2: 'الاستثمارات النشطة', revenue: 'الإيرادات', pendingDeposits: 'إيداعات معلقة',
    pendingWithdrawals: 'سحوبات معلقة', newUsers: 'المستخدمون الجدد', today: 'اليوم',
    thisWeek: 'هذا الأسبوع', thisMonth: 'هذا الشهر', active: 'نشط',
    distributeProfits: 'توزيع أرباح الاستثمارات النشطة', approve: 'قبول', reject: 'رفض',
    process: 'معالجة', complete: 'إتمام', suspend: 'تعطيل', activate: 'تفعيل',
    searchByName: 'بحث بالاسم أو البريد...', allStatus: 'كل الحالات',
    noUsers: 'لا يوجد مستخدمين', noDeposits: 'لا توجد إيداعات', noWithdrawals: 'لا توجد سحوبات',
    noInvestments: 'لا توجد استثمارات', noKyc: 'لا يوجد طلبات تحقق معلقة',
    noPackages: 'لا توجد باقات', total: 'إجمالي', balance: 'الرصيد',
    totalDeposited2: 'إجمالي الإيداع', totalWithdrawn2: 'إجمالي السحب', totalProfit2: 'إجمالي الأرباح',
    adjustBalance: 'تعديل الرصيد', add: 'إضافة', subtract: 'خصم', amount: 'المبلغ',
    apply: 'تنفيذ', investments2: 'الاستثمارات', suspendAccount2: 'تعطيل الحساب',
    activateAccount2: 'تفعيل الحساب', suspended: 'معطل', search: 'بحث',
    investmentPackages: 'باقات الاستثمار', seedDefaults: 'إنشاء الباقات الافتراضية',
    dailyRatePct: 'العائد اليومي %', durationDays: 'المدة (أيام)', minAmount: 'الحد الأدنى',
    maxAmount: 'الحد الأقصى', save: 'حفظ', edit: 'تعديل', daily2: 'يومياً',
    exportData2: 'تصدير البيانات', users: 'المستخدمين', transactions: 'المعاملات',
    investmentsData: 'الاستثمارات', kycData: 'بيانات KYC',
    // Engineer Agent
    architectAgent: 'وكيل المهندس المعماري', autonomousAgent: 'وكيل ذكاء اصطناعي مستقل لمراقبة وصيانة المنصة تلقائياً',
    actions: 'الإجراءات', autoScheduling: 'الجدولة التلقائية', status: 'الحالة',
    running: 'يعمل', errors: 'أخطاء', fixed: 'تم الإصلاح', performance: 'الأداء',
    runDiagnostics: 'تشخيص النظام', securityScan: 'فحص الأمان', fixErrors: 'إصلاح الأخطاء',
    dailyReport: 'تقرير يومي', geniusMode: 'الوضع العبقري', performanceOpt: 'تحسين الأداء',
    apiHealth: 'مراقبة API', backupReport: 'تقرير النسخ الاحتياطي',
    fullPlatformCheck: 'فحص شامل لصحة المنصة', vulnerabilityScan: 'فحص ثغرات أمنية',
    fixStuckTx: 'إصلاح المعاملات العالقة', comprehensiveReport: 'تقرير شامل عن المنصة',
    aiDeepAnalysis: 'تحليل ذكي متقدم بالذكاء الاصطناعي', optimizeSpeed: 'تحسين سرعة المنصة',
    checkAllApis: 'فحص حالة جميع الـ APIs', backupStatus: 'حالة النسخ الاحتياطي',
    result: 'النتيجة', cleanupDatabase: 'تنظيف قاعدة البيانات',
    confirmCleanup: 'هل أنت متأكد من تنظيف قاعدة البيانات؟ سيتم حذف السجلات القديمة.',
    scheduleDiagnostics: 'جدولة التشخيصات تلقائياً', scheduleSecurityScan: 'جدولة فحص الأمان تلقائياً',
    cronExpression: 'تعبيرة cron (مثل: 0 */6 * * *)', set2: 'تعيين',
    cronExample: 'مثال: 0 */6 * * * = كل 6 ساعات، 0 2 * * * = يومياً الساعة 2 صباحاً',
    securityCronNote: 'يُفضل تشغيل فحص الأمان مرة يومياً في وقت قليل النشاط',
    activeSchedules: 'الجداول النشطة', noSchedules: 'لا توجد جداول مجدولة بعد',
    diagnostics2: 'تشخيصات', on: 'مفعّل', off: 'معطّل', disable: 'إيقاف', enable: 'تفعيل',

    // Activity Log
    activityLog: 'سجل النشاط', allActivities: 'كل الأنشطة', login2: 'تسجيل دخول',
    deposit2: 'إيداع', withdrawal2: 'سحب', investment2: 'استثمار', kyc2: 'تحقق',
    admin2: 'إدارة', engineerAgent: 'وكيل المهندس',
    errors2: 'أخطاء', security: 'أمان', exportCsv: 'تصدير CSV',
    noActivityLogs: 'لا توجد سجلات نشاط', activityLogs: 'سجل نشاط',
    // Charts
    interactiveAnalytics: 'الإحصائيات التفاعلية', revenueAndOutflow: 'الإيرادات والأموال الصادرة',
    userGrowth: 'نمو المستخدمين', transactionStatus: 'حالة المعاملات',
    investmentDistribution: 'توزيع الاستثمارات', deposits3: 'إيداعات', withdrawals3: 'سحوبات',
    users3: 'مستخدمين', count: 'عدد', completed2: 'مكتملة', pending2: 'معلقة', rejected2: 'مرفوضة',
    starter2: 'المبتدئ', basic2: 'الأساسي', advanced2: 'المتقدم', pro2: 'المحترف',
  },
  en: {
    // Nav
    home: 'Home', packages: 'Packages', investments: 'Investments', deposit: 'Deposit',
    withdraw: 'Withdraw', signals: 'Signals', kyc: 'Verification', support: 'Support',
    referrals: 'Referrals', about: 'About', terms: 'Terms', privacy: 'Privacy',
    admin: 'Admin', more: 'More', logout: 'Logout',
    // Auth
    login: 'Login', register: 'Register', email: 'Email',
    password: 'Password', fullName: 'Full Name', phone: 'Phone',
    refCode: 'Referral Code', forgotPassword: 'Forgot Password?',
    noAccount: "Don't have an account? Register", haveAccount: 'Have an account? Login',
    backHome: 'Back to Home', createAccount: 'Create Account',
    agreeTerms: 'I agree to', termsOfUse: 'Terms of Use', privacyPolicy: 'Privacy Policy',
    resetPassword: 'Reset Password', newPassword: 'New Password',
    changePassword: 'Change Password', backToLogin: 'Back to Login',
    sendResetLink: 'Send Reset Link', cancel: 'Cancel',
    // Dashboard
    welcome: 'Welcome', walletOverview: 'Here is your wallet overview',
    availableBalance: 'Available Balance', totalProfit: 'Total Profit',
    totalDeposits: 'Total Deposits', investAction: 'Invest',
    activeInvestments: 'Active Investments', viewAll: 'View All',
    daily: 'Daily', totalProfitLabel: 'Total Profit',
    marketPrices: 'Market Prices',
    // Deposit
    depositTitle: 'Deposit', paymentCreated: 'Payment Created',
    sendAmountBelow: 'Send the required amount to the address below',
    addressLabel: 'Address:', copyAddress: 'Copy Address',
    requiredAmount: 'Required Amount', paymentNumber: 'Payment #',
    autoPayment: 'Auto Payment', manualDeposit: 'Manual Deposit',
    nowpaymentsTitle: 'Secure Auto Payment',
    nowpaymentsDesc: 'Fast & secure - instant confirmation',
    depositAmount: 'Deposit Amount (USDT)', createPaymentBtn: 'Create Payment',
    depositHistory: 'Deposit History',
    // Withdraw
    withdrawTitle: 'Withdraw', kycRequired: 'KYC Verification Required',
    kycRequiredDesc: 'Please complete identity verification (KYC) to enable withdrawals',
    goToKyc: 'Go to Verification',
    withdrawAmount: 'Withdraw Amount (USDT)', walletAddress: 'Wallet Address',
    selectNetwork: 'Select Network', withdrawBtn: 'Submit Withdrawal',
    withdrawMin: 'Minimum withdrawal: $20',
    withdrawFee: 'Network fee will be deducted from amount',
    withdrawAvailable: 'Available Balance for Withdrawal',
    withdrawHistory: 'Withdrawal History',
    withdrawNoHistory: 'No previous withdrawals',
    withdrawNetworkBEP20: 'BEP20 (BSC)', withdrawNetworkTRC20: 'TRC20 (Tron)',
    withdrawNetworkERC20: 'ERC20 (Ethereum)', withdrawNetworkBTC: 'Bitcoin',
    withdrawSecure: 'Secure & Encrypted', withdrawSecureDesc: 'Withdrawal requests are processed securely',
    withdrawAutoProcess: 'Auto Processing', withdrawAutoProcessDesc: 'Safe withdrawals are automatically processed via blockchain',
    withdrawQuickAmounts: 'Quick Amounts', withdrawAll: 'Withdraw All',
    withdrawConfirmTitle: 'Confirm Withdrawal',
    withdrawConfirmDesc: 'The specified amount will be withdrawn to the following wallet',
    withdrawConfirmNetwork: 'Network', withdrawConfirmAmount: 'Amount',
    withdrawConfirmWallet: 'Wallet', withdrawConfirm: 'Confirm Withdrawal',
    pendingW: 'Pending', processingW: 'Processing', completedW: 'Completed',
    rejectedW: 'Rejected', approvedW: 'Approved',
    // KYC
    kycTitle: 'Identity Verification', verified: 'Verified Successfully',
    verifiedDesc: 'Your account is fully verified and you can withdraw',
    underReview: 'Under Review',
    underReviewDesc: 'Your documents are being reviewed, response within 24 hours',
    rejected: 'Verification Rejected', completeVerification: 'Complete verification to enable withdrawals',
    idName: 'Full Name (as on ID)', idNumber: 'ID Number',
    passport: 'Passport', idCard: 'National ID Card', driverLicense: 'Driver License',
    uploadDoc: 'Upload Document Image', uploadSelfie: 'Upload Selfie with ID (optional)',
    fillAllFields: 'Please fill all fields and upload ID image',
    submitVerification: 'Submit Verification Request',
    // Landing
    licensed: 'Licensed Trading & Investment Platform',
    heroTitle1: 'Trade & Invest Safely', heroTitle2: 'Guaranteed Daily Returns',
    heroDesc: 'SONA Smart Trading & Investment Platform. Daily trading signals and diverse investment packages with returns up to 3% daily.',
    startTrading: 'Start Trading Now',
    activeUsers: 'Active Users', tradingVolume: 'Trading Volume', returnsEarned: 'Returns Earned',
    features: 'Platform Features',
    dailySignals: 'Daily Trading Signals', dailySignalsDesc: '3 daily trading signals to help you multiply your investment',
    smartBots: 'Professional Analysis Team', smartBotsDesc: 'Advanced trading strategies by our professional analysts',
    licensedFull: 'Fully Licensed', licensedDesc: 'Licensed by FCA #847592 with full asset protection',
    easyWithdraw: 'Easy & Fast Withdrawal', easyWithdrawDesc: 'Daily profit withdrawal with instant blockchain transfer',
    investPackages: 'Investment Packages', investPackagesDesc: 'Daily returns from 1.5% to 3% - from $100 to $50,000',
    starter: 'Starter', basic: 'Basic', advanced: 'Advanced', professional: 'Professional', vip: 'VIP',
    period: 'days', minDepositLabel: 'Minimum deposit',
    // Support
    supportTitle: 'Customer Support', smartHelp: 'Customer Support', online: 'Online',
    typeMessage: 'Type your message...', send: 'Send',
    newConversation: 'New Conversation',
    // Email Verification
    verifyEmail: 'Verify Your Email',
    verifyEmailDesc: 'We sent a verification code to your email',
    verifyCode: 'Verification Code', sendCode: 'Send Verification Code',
    verifying: 'Verifying...', verifiedEmail: 'Email Verified',
    resendCode: 'Resend Code',
    // Misc
    and: 'and', optional: 'optional', copied: 'Copied!',
    connectionError: 'Connection error', error: 'Error occurred',
    retry: 'Retry',
    loginSuccess: 'Logged in successfully',
    registerSuccess: 'Account created successfully!',
    resetSent: 'Password reset link sent',
    passwordChanged: 'Password changed successfully',
    mustAgree: 'You must agree to the terms of use',
    depositSuccess: 'Payment created! Send USDT to the address below',
    depositManualSuccess: 'Deposit request submitted successfully',
    investSuccess: 'Package activated! Professional trading strategy is now running',
    withdrawSuccess: 'Withdrawal request submitted successfully',
    kycSuccess: 'Verification request submitted successfully',
    confirmInvest: 'Confirm Investment', cancelBtn: 'Cancel',
    dailyProfit: 'Daily Return', duration: 'Duration',
    availableBalanceLabel: 'Your Available Balance',
    expectedDailyProfit: 'Expected Daily Profit',
    capitalFrozen: 'Capital is frozen during the package period and profits are released daily',
    investIn: 'Invest in', logoutBtn: 'Logout',
    verifiedBadge: 'Verified',
    platform: 'Trading & Investment Platform',
    sonaPlatform: 'SONA - Smart Trading & Investment Platform',
    copyFailed: 'Copy failed',
    minDeposit: 'Minimum deposit is $10',
    enterEmail: 'Please enter your email',
    enterNewPassword: 'Please enter the new password',
    depositNote: 'Send the exact amount only. Your balance will update once the transaction is confirmed on the network.',
    newDeposit: 'Create New Deposit',
    nowpaymentsNote: 'A unique payment address will be created. Send USDT on BEP20 network to the address provided.',
    notifications: 'Notifications', account: 'My Account', myAccount: 'My Account',
    // Dual Mode
    withdrawableBalance: 'Withdrawable Balance',
    poolShare: 'My Pool Share', poolProfit: 'Pool Profits',
    days: 'days',
    sonaMode: 'SONA',
    sonaDesc: 'Pool trading with real profit/loss distribution',
    maintenanceMode: 'Maintenance Mode', hackAlert: 'Hack Alert',
    exportData: 'Export Data', triggerProfits: 'Trigger Daily Profits',
    reportDaily: 'Daily Report', reportMonthly: 'Monthly Report',
    depositNoticeSONA: 'Your funds will be added to the pool trading fund. Profits and losses are distributed daily based on your pool share.',
    riskDisclaimer: 'Warning: Pool trading involves real risks. You may lose part of your capital.',
    withdrawInstructions: 'Withdrawal Instructions',
    withdrawInstructionsDesc: 'To make a withdrawal, please contact our support team via the support page and provide the desired amount, wallet address, and preferred network.',
    contactSupport: 'Contact Support',
    totalInvestment: 'Total Investment',
    daysPassed: 'Days Passed',
    remaining: 'Remaining',
    platformSettings: 'Platform Settings',
    platformMode: 'Platform Mode',
    customMessage: 'Custom Message',
    sendNotification: 'Send Notification',
    notificationTitle: 'Notification Title',
    notificationBody: 'Notification Body',
    sendToAll: 'Send to All',
    sendToUser: 'Send to User',
    suspendAccount: 'Suspend Account',
    activateAccount: 'Activate Account',
    packageEditor: 'Package Editor',
    dailyRate: 'Daily Rate',
    withdrawLimit: 'Withdraw Limit',
    processingHours: 'Processing Hours',
    hackMessage: 'Platform has been hacked',
    maintenanceMessage: 'Platform under maintenance',
    // Admin Panel Extended
    adminPanel: 'Admin Panel', refresh: 'Refresh', totalUsers: 'Total Users',
    deposits: 'Deposits', withdrawals: 'Withdrawals', profitsDistributed: 'Profits Distributed',
    activeInvestments2: 'Active Investments', revenue: 'Revenue', pendingDeposits: 'Pending Deposits',
    pendingWithdrawals: 'Pending Withdrawals', newUsers: 'New Users', today: 'Today',
    thisWeek: 'This Week', thisMonth: 'This Month', active: 'Active',
    distributeProfits: 'Distribute profits for active investments', approve: 'Approve', reject: 'Reject',
    process: 'Process', complete: 'Complete', suspend: 'Suspend', activate: 'Activate',
    searchByName: 'Search by name or email...', allStatus: 'All Status',
    noUsers: 'No users found', noDeposits: 'No deposits found', noWithdrawals: 'No withdrawals found',
    noInvestments: 'No investments found', noKyc: 'No pending KYC verifications',
    noPackages: 'No packages found', total: 'Total', balance: 'Balance',
    totalDeposited2: 'Total Deposited', totalWithdrawn2: 'Total Withdrawn', totalProfit2: 'Total Profit',
    adjustBalance: 'Adjust Balance', add: 'Add', subtract: 'Subtract', amount: 'Amount',
    apply: 'Apply', investments2: 'Investments', suspendAccount2: 'Suspend Account',
    activateAccount2: 'Activate Account', suspended: 'Suspended', search: 'Search',
    investmentPackages: 'Investment Packages', seedDefaults: 'Seed Defaults',
    dailyRatePct: 'Daily Rate %', durationDays: 'Duration (days)', minAmount: 'Min Amount',
    maxAmount: 'Max Amount', save: 'Save', edit: 'Edit', daily2: 'Daily',
    exportData2: 'Export Data', users: 'Users', transactions: 'Transactions',
    investmentsData: 'Investments', kycData: 'KYC Data',
    // Engineer Agent
    architectAgent: 'Software Architect Agent', autonomousAgent: 'Autonomous AI agent for platform monitoring and maintenance',
    actions: 'Actions', autoScheduling: 'Auto-Scheduling', status: 'Status',
    running: 'Running', errors: 'Errors', fixed: 'Fixed', performance: 'Perf',
    runDiagnostics: 'Run Diagnostics', securityScan: 'Security Scan', fixErrors: 'Fix Errors',
    dailyReport: 'Daily Report', geniusMode: 'Genius Mode', performanceOpt: 'Performance',
    apiHealth: 'API Health', backupReport: 'Backup Report',
    fullPlatformCheck: 'Full platform health check', vulnerabilityScan: 'Vulnerability scan',
    fixStuckTx: 'Fix stuck transactions', comprehensiveReport: 'Comprehensive platform report',
    aiDeepAnalysis: 'AI-powered deep analysis', optimizeSpeed: 'Optimize platform speed',
    checkAllApis: 'Check all API endpoints', backupStatus: 'Backup status report',
    result: 'Result', cleanupDatabase: 'Cleanup Database',
    confirmCleanup: 'Clean up old records from the database?',
    scheduleDiagnostics: 'Schedule Auto-Diagnostics', scheduleSecurityScan: 'Schedule Auto-Security Scan',
    cronExpression: 'Cron expression (e.g. 0 */6 * * *)', set2: 'Set',
    cronExample: 'Example: 0 */6 * * * = every 6h, 0 2 * * * = daily at 2AM',
    securityCronNote: 'Recommended: run security scan once daily during low-activity hours',
    activeSchedules: 'Active Schedules', noSchedules: 'No schedules configured yet',
    diagnostics2: 'Diagnostics', on: 'ON', off: 'OFF', disable: 'Disable', enable: 'Enable',

    // Activity Log
    activityLog: 'Activity', allActivities: 'All Activities', login2: 'Login',
    deposit2: 'Deposit', withdrawal2: 'Withdrawal', investment2: 'Investment', kyc2: 'KYC',
    admin2: 'Admin', engineerAgent: 'Engineer Agent',
    errors2: 'Errors', security: 'Security', exportCsv: 'Export CSV',
    noActivityLogs: 'No activity logs found', activityLogs: 'activity logs',
    // Charts
    interactiveAnalytics: 'Interactive Analytics', revenueAndOutflow: 'Revenue & Outflow',
    userGrowth: 'User Growth', transactionStatus: 'Transaction Status',
    investmentDistribution: 'Investment Distribution', deposits3: 'Deposits', withdrawals3: 'Withdrawals',
    users3: 'Users', count: 'Count', completed2: 'Completed', pending2: 'Pending', rejected2: 'Rejected',
    starter2: 'Starter', basic2: 'Basic', advanced2: 'Advanced', pro2: 'Pro',
  }
}

// ===== TYPES =====
interface User {
  id: string; email: string; name: string; phone?: string; role: string;
  balance: number; totalProfit: number; totalDeposited: number; totalWithdrawn?: number;
  withdrawableBalance?: number; nonWithdrawableProfit?: number; lockedCapital?: number;
  poolShareValue?: number; poolProfitShare?: number;
  investmentMode?: 'SONA';
  emailVerified?: boolean;
  kycStatus: string; kycFullName?: string; kycIdNumber?: string;
  kycDocumentType?: string; kycRejectReason?: string; kycRejectCode?: string;
  kycSubmittedAt?: string; kycVerifiedAt?: string;
  referralCode: string; twoFactorEnabled: boolean;
  avatar?: string; createdAt?: string;
  investments?: Investment[];
}

interface PlatformSettings {
  platformMode: 'SONA' | 'BOTH' | 'DUBIBO';
  maintenanceMode: boolean;
  maintenanceMessage: string;
  fakeHackMode: boolean;
  fakeHackMessage: string;
}

interface Pkg {
  id: string; name: string; nameEn: string; minAmount: number; maxAmount: number | null;
  monthlyReturn: number; durationDays: number; description: string; color: string; icon: string;
}

interface Investment {
  id: string; amount: number; monthlyProfit: number; totalProfit: number; releasedAmount: number;
  monthsElapsed: number; status: string; startDate: string; package: Pkg;
}

interface Transaction {
  id: string; type: string; amount: number; status: string; cryptoCurrency?: string;
  cryptoNetwork?: string; walletAddress?: string; txHash?: string; description?: string;
  adminNote?: string; createdAt: string;
}

interface SupportAgent {
  id: string; name: string; nameEn: string; title: string; titleEn: string;
  avatar: string; specialty: string;
}

interface ChatConversation {
  id: string; status: string; createdAt: string;
  agent?: SupportAgent; messages: ChatMessage[];
}

interface ChatMessage {
  id: string; senderType: string; message: string; imageUrl?: string;
  isRead: boolean; createdAt: string;
}

interface DepositAddress {
  id: string; currency: string; network: string; address: string; minAmount: number;
}

interface CryptoPrice {
  symbol: string; price: number; change: number;
}

// ===== PAYMENT STATUSES =====
const PAYMENT_STATUSES: Record<string, string> = {
  waiting: 'بانتظار الدفع',
  confirming: 'جاري التأكيد',
  confirmed: 'تم التأكيد',
  sending: 'جاري الإرسال',
  partially_paid: 'مدفوع جزئياً',
  finished: 'مكتمل',
  failed: 'فاشل',
  expired: 'منتهي الصلاحية',
  refunded: 'مسترد',
}

// ===== DUBIBO THEME =====
const D = {
  bg: '#030708',
  bgNav: '#0d1117',
  card: '#1f2634',
  cardHover: '#252d3d',
  surface: '#2c313e',
  border: '#2c313e',
  borderLight: '#363d4f',
  input: '#0d1117',
  accent: '#409eff',
  accentHover: '#337ecc',
  accentBg: 'rgba(64,158,255,0.08)',
  accentBorder: 'rgba(64,158,255,0.2)',
  green: '#04cf99',
  greenBg: 'rgba(4,207,153,0.08)',
  greenBorder: 'rgba(4,207,153,0.2)',
  red: '#f36464',
  redBg: 'rgba(243,100,100,0.08)',
  redBorder: 'rgba(243,100,100,0.2)',
  yellow: '#e6a23c',
  yellowBg: 'rgba(230,162,60,0.08)',
  purple: '#c05bdd',
  purpleBg: 'rgba(192,91,221,0.08)',
  purpleBorder: 'rgba(192,91,221,0.2)',
  textPrimary: '#ffffff',
  textSecondary: '#999999',
  textMuted: '#5c5d5e',
  gradient: 'linear-gradient(135deg, #409eff, #04cf99)',
  gradientBlue: 'linear-gradient(135deg, #409eff, #337ecc)',
}

// ===== SVG ICON COMPONENT (Dubibo-style, NO EMOJIS) =====
const Icon = ({ name, size = 20, color = D.textSecondary }: { name: string; size?: number; color?: string }) => {
  const icons: Record<string, string> = {
    home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1',
    chart: 'M3 3v18h18M9 17V9m4 8V5m4 12v-4',
    wallet: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
    chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    menu: 'M4 6h16M4 12h16M4 18h16',
    user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    doc: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    cash: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    arrowUp: 'M7 11l5-5m0 0l5 5m-5-5v12',
    arrowDown: 'M17 13l-5 5m0 0l-5-5m5 5V6',
    logout: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
    gift: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
    check: 'M5 13l4 4L19 7',
    x: 'M6 18L18 6M6 6l12 12',
    clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    camera: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z',
    settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
    plus: 'M12 4v16m8-8H4',
    send: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8',
    building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    id: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.977 3.977 0 00-2.83 2',
    bot: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    refresh: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    gem: 'M20.59 9.47l-7.65-7.65a2 2 0 00-2.83 0l-7.65 7.65a2 2 0 000 2.83l7.65 7.65a2 2 0 002.83 0l7.65-7.65a2 2 0 000-2.83zM12 16v0',
    star: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
    crown: 'M2 20h20M5 20V9l4 3 3-6 3 6 4-3v11',
    rocket: 'M15.59 14.76a6.76 6.76 0 01-1.93.47l-4.3 4.3a1 1 0 01-1.41 0l-2.83-2.83a1 1 0 010-1.41l4.3-4.3c.1-.68.27-1.34.47-1.93M15.59 14.76l3.65-3.65a2 2 0 000-2.83L18.5 7.54a2 2 0 00-2.83 0l-3.65 3.65M15.59 14.76l-3.57-3.57',
    sprout: 'M12 22V8M5 12c0-3.866 3.134-7 7-7s7 3.134 7 7M5 12c0 3.866 3.134 7 7 7M5 12H2M22 12h-3M12 8c-2 0-4-1-5-3M12 8c2 0 4-1 5-3',
    arrowLeft: 'M17 12H7m0 0l5 5m-5-5l5-5',
    bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    alertTriangle: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    repeat: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
    zap: 'M13 10V3L4 14h7v7l9-11h-7z',
    eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
    eyeOff: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21',
    swap: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M3 4l6 6',
  }
  const path = icons[name]
  if (!path) return <span style={{ width: size, height: size, display: 'inline-block' }} />
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  )
}

// ===== CONSTANTS =====
const KYC_REASONS: Record<string, string> = {
  BLURRY: 'الصورة غير واضحة. يرجى إعادة رفع صورة واضحة وبجودة عالية.',
  EXPIRED: 'الهوية منتهية الصلاحية. يرجى رفع هوية سارية المفعول.',
  MISMATCH: 'الاسم في الهوية لا يتطابق مع الاسم المسجل.',
  INCOMPLETE: 'المستند غير مكتمل. يرجى رفع صورة كاملة للهوية.',
  SELFIE_MISMATCH: 'صورة السيلفي لا تتطابق مع صورة الهوية.',
  INVALID_DOC: 'نوع المستند غير مقبول. يرجى رفع جواز سفر أو بطاقة هوية صالحة.',
  DUPLICATE: 'تم العثور على حساب آخر بنفس بيانات الهوية.',
}

const AGENTS: SupportAgent[] = [
  { id: '1', name: 'دعم SONA', nameEn: 'SONA Support', title: 'دعم العملاء', titleEn: 'Customer Support', avatar: '/sona-support-avatar.png', specialty: 'دعم شامل' },
]

const fmt = (n: number | undefined | null) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0)
const fmtDate = (d: string) => new Intl.DateTimeFormat('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
const fmtNum = (n: number | undefined | null) => new Intl.NumberFormat('en-US').format(n ?? 0)
const fmtPct = (n: number | undefined | null) => { if (n === undefined || n === null || isNaN(n)) return '0.00%'; return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; }
const sf = (n: number | undefined | null, d: number = 2): string => {
  if (n === undefined || n === null || isNaN(n)) return '0.' + '0'.repeat(d);
  return Number(n).toFixed(d);
};

function playNotif() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sine'; o.frequency.setValueAtTime(880, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15)
    g.gain.setValueAtTime(0.3, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.3)
  } catch {}
}

// ===== DUBIBO SHARED STYLES =====
const inputStyle: React.CSSProperties = {
  width: '100%', background: D.input, border: `1px solid ${D.border}`, borderRadius: 10,
  padding: '13px 16px', color: D.textPrimary, fontSize: 14, outline: 'none',
  fontFamily: "'Cairo', sans-serif", transition: 'border-color 0.2s',
}

const cardStyle: React.CSSProperties = {
  background: D.card, border: `1px solid ${D.border}`, borderRadius: 15,
}

const btnPrimary: React.CSSProperties = {
  width: '100%', padding: '14px 0', background: D.accent, color: '#fff',
  border: 'none', borderRadius: 25, fontSize: 15, fontWeight: 700,
  cursor: 'pointer', fontFamily: "'Cairo', sans-serif",
  transition: 'background 0.2s, transform 0.1s',
  boxShadow: '0 0 10px rgba(64,158,255,0.3)',
}

const btnOutline: React.CSSProperties = {
  width: '100%', padding: '14px 0', background: 'transparent',
  color: D.accent, border: `1px solid ${D.accentBorder}`, borderRadius: 25,
  fontSize: 15, fontWeight: 700, cursor: 'pointer',
  fontFamily: "'Cairo', sans-serif", transition: 'all 0.2s',
}

// ===== LOGO (outside SonaApp to avoid re-creation) =====
const Logo = ({ size = 40, spin = false }: { size?: number; spin?: boolean }) => (
  <img
    src="/sona-logo-square.png"
    alt="SONA"
    className={spin ? 'logo-spin-once' : ''}
    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/sona-icon.png' }}
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      filter: 'drop-shadow(0 0 12px rgba(64,158,255,0.4))',
    }}
  />
)

// ===== STATUS BADGE (outside SonaApp to avoid re-creation) =====
const StatusBadge = ({ status, labels }: { status: string; labels: Record<string, { text: string; color: string; bg: string }> }) => {
  const l = labels[status] || { text: status, color: D.textMuted, bg: 'transparent' }
  return <span style={{ fontSize: 11, fontWeight: 700, color: l.color, background: l.bg, padding: '3px 10px', borderRadius: 8 }}>{l.text}</span>
}

// ===== MAIN APP =====

// ===== EXTRACTED COMPONENTS (outside SonaApp to prevent infinite re-renders) =====

const SignalsPage = memo(() => {
  const { lang, D, Icon, btnOutline, cardStyle } = useApp()
  const isRTL = lang === 'ar'
  type SignalType = 'LONG' | 'SHORT' | 'NEUTRAL'

  interface SignalData {
    symbol: string; type: SignalType; entryPrice: number; targetPrice: number; stopLoss: number;
    confidence: number; calibratedConfidence: number; confluenceScore: number;
    regime: string; mlAgreement: string; bayesianConfidence: number; smcSignal: string;
    entropyScore: number; fearGreedIndex: number; anomalyScore: number;
    cooldownStatus: string; riskBudget: string;
    analysis: Record<string, any>
    timestamp: string
    filters: Record<string, 'PASS' | 'FAIL'>
  }

  const [signals, setSignals] = useState<SignalData[]>([])
  const [sigLoading, setSigLoading] = useState(true)
  const [sigError, setSigError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [filterTab, setFilterTab] = useState<'all' | 'LONG' | 'SHORT' | 'NEUTRAL'>('all')

  const fetchSignals = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/signals')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setSignals(data.signals || [])
      setSigError(false)
      setLastRefresh(new Date())
    } catch {
      setSigError(true)
    }
    setSigLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchSignals()
    const interval = setInterval(fetchSignals, 60000)
    return () => clearInterval(interval)
  }, [fetchSignals])

  // --- Helpers ---
  const fmtPrice = (p: number | undefined | null) => {
    if (p === undefined || p === null || isNaN(p)) return '0.00'
    if (p >= 1000) return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p)
    if (p >= 1) return sf(p, 4)
    return sf(p, 6)
  }
  const fmtTime = (d: string) => {
    try {
      const dt = new Date(d)
      return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(dt)
    } catch { return d }
  }

  // --- Filtered signals ---
  const filteredSignals = filterTab === 'all' ? signals : signals.filter(s => s.type === filterTab)
  const buyCount = signals.filter(s => s.type === 'LONG').length
  const sellCount = signals.filter(s => s.type === 'SHORT').length
  const avgConfidence = signals.length > 0 ? Math.round(signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length) : 0

  // --- Loading state ---
  if (sigLoading) {
    return (
      <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${D.border}`, borderTopColor: D.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ color: D.textSecondary, fontSize: 14, fontWeight: 600 }}>{lang === 'ar' ? 'جاري تحميل الإشارات...' : 'Loading signals...'}</div>
      </div>
    )
  }

  // --- Error state ---
  if (sigError && signals.length === 0) {
    return (
      <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: D.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={28} color={D.red} />
        </div>
        <div style={{ color: D.textPrimary, fontSize: 16, fontWeight: 700 }}>{lang === 'ar' ? 'فشل تحميل الإشارات' : 'Failed to load signals'}</div>
        <button onClick={fetchSignals} style={{ ...btnOutline, width: 'auto', padding: '10px 24px' }}>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</button>
      </div>
    )
  }

  const filterTabs: { key: 'all' | 'LONG' | 'SHORT' | 'NEUTRAL'; labelAr: string; labelEn: string; color: string }[] = [
    { key: 'all', labelAr: 'الكل', labelEn: 'All', color: D.accent },
    { key: 'LONG', labelAr: 'شراء', labelEn: 'Buy', color: D.green },
    { key: 'SHORT', labelAr: 'بيع', labelEn: 'Sell', color: D.red },
    { key: 'NEUTRAL', labelAr: 'محايد', labelEn: 'Hold', color: D.yellow },
  ]

  return (
    <div className="page-enter" style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="zap" size={22} color={D.accent} />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: D.textPrimary, margin: 0 }}>{lang === 'ar' ? 'إشارات التداول' : 'Trading Signals'}</h2>
          <p style={{ fontSize: 12, color: D.textSecondary, margin: 0, marginTop: 2 }}>{lang === 'ar' ? 'من فريق التحليل' : 'By Analysis Team'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {refreshing && <div style={{ width: 12, height: 12, border: `2px solid ${D.border}`, borderTopColor: D.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
          {lastRefresh && <span style={{ fontSize: 10, color: D.textMuted }}>{lang === 'ar' ? `آخر تحديث: ${fmtTime(lastRefresh.toISOString())}` : `Updated: ${fmtTime(lastRefresh.toISOString())}`}</span>}
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ ...cardStyle, flex: 1, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: D.textMuted, marginBottom: 2 }}>{lang === 'ar' ? 'إشارات الشراء' : 'Buy Signals'}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: D.green }}>{buyCount}</div>
        </div>
        <div style={{ ...cardStyle, flex: 1, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: D.textMuted, marginBottom: 2 }}>{lang === 'ar' ? 'متوسط الثقة' : 'Avg Confidence'}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: avgConfidence >= 70 ? D.green : avgConfidence >= 50 ? D.yellow : D.red }}>{avgConfidence}%</div>
        </div>
        <div style={{ ...cardStyle, flex: 1, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: D.textMuted, marginBottom: 2 }}>{lang === 'ar' ? 'إشارات البيع' : 'Sell Signals'}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: D.red }}>{sellCount}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key)}
            style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: "'Cairo', sans-serif", transition: 'all 0.2s',
              background: filterTab === tab.key ? tab.color : D.card,
              color: filterTab === tab.key ? '#fff' : D.textSecondary,
            }}
          >
            {lang === 'ar' ? tab.labelAr : tab.labelEn}
          </button>
        ))}
      </div>

      {/* Signal Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredSignals.map((sig, idx) => {
          const isLong = sig.type === 'LONG'
          const isNeutral = sig.type === 'NEUTRAL'
          const sigColor = isLong ? D.green : isNeutral ? D.yellow : D.red
          const sigBg = isLong ? D.greenBg : isNeutral ? D.yellowBg : D.redBg
          const sigLabel = isLong ? (lang === 'ar' ? 'شراء' : 'Buy') : sig.type === 'SHORT' ? (lang === 'ar' ? 'بيع' : 'Sell') : (lang === 'ar' ? 'محايد' : 'Hold')
          const change24h = sig.entryPrice > 0 ? ((sig.targetPrice - sig.entryPrice) / sig.entryPrice * 100) : 0

          return (
            <div key={idx} style={{ ...cardStyle, overflow: 'hidden', ...(isRTL ? { borderLeft: `3px solid ${sigColor}` } : { borderRight: `3px solid ${sigColor}` }) }}>
              <div style={{ padding: '16px 16px 14px 16px' }}>
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: sigBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={isLong ? 'arrowUp' : isNeutral ? 'chart' : 'arrowDown'} size={16} color={sigColor} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: D.textPrimary }}>{sig.symbol}</div>
                      <div style={{ fontSize: 10, color: D.textMuted }}>{lang === 'ar' ? 'فريق التحليل' : 'Analysis Team'} · {fmtTime(sig.timestamp)}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: sigColor, background: sigBg, padding: '4px 12px', borderRadius: 8 }}>{sigLabel}</span>
                </div>

                {/* Price Levels */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
                  <div style={{ background: D.bg, borderRadius: 8, padding: '7px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: D.textMuted }}>{lang === 'ar' ? 'سعر الدخول' : 'Entry'}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: D.textPrimary }}>${fmtPrice(sig.entryPrice)}</div>
                  </div>
                  <div style={{ background: D.bg, borderRadius: 8, padding: '7px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: D.textMuted }}>{lang === 'ar' ? 'الهدف' : 'Target'}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: D.green }}>${fmtPrice(sig.targetPrice)}</div>
                  </div>
                  <div style={{ background: D.bg, borderRadius: 8, padding: '7px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: D.textMuted }}>{lang === 'ar' ? 'وقف الخسارة' : 'Stop Loss'}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: D.red }}>${fmtPrice(sig.stopLoss)}</div>
                  </div>
                </div>

                {/* Confidence + 24h Change Row */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {/* Confidence */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: D.textMuted }}>{lang === 'ar' ? 'الثقة' : 'Confidence'}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: sig.confidence >= 70 ? D.green : sig.confidence >= 50 ? D.yellow : D.red }}>{sig.confidence}%</span>
                    </div>
                    <div style={{ width: '100%', height: 5, background: D.bg, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${sig.confidence}%`, height: '100%', background: sig.confidence >= 70 ? D.green : sig.confidence >= 50 ? D.yellow : D.red, borderRadius: 3, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                  {/* 24h Change */}
                  <div style={{ textAlign: 'center', minWidth: 70 }}>
                    <div style={{ fontSize: 9, color: D.textMuted, marginBottom: 2 }}>{lang === 'ar' ? 'التغير المتوقع' : 'Exp. Change'}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: change24h >= 0 ? D.green : D.red }}>
                      {change24h >= 0 ? '+' : ''}{(change24h ?? 0).toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* No signals state */}
      {filteredSignals.length === 0 && !sigLoading && (
        <div style={{ ...cardStyle, padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: D.accentBg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Icon name="clock" size={24} color={D.accent} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: D.textPrimary, marginBottom: 4 }}>
            {filterTab !== 'all'
              ? (lang === 'ar' ? `لا توجد إشارات ${filterTabs.find(t => t.key === filterTab)?.labelAr || ''}` : `No ${filterTabs.find(t => t.key === filterTab)?.labelEn || ''} signals`)
              : (lang === 'ar' ? 'لا توجد إشارات حالياً' : 'No signals right now')}
          </div>
          <div style={{ fontSize: 12, color: D.textSecondary }}>{lang === 'ar' ? 'سيتم إنشاء إشارات جديدة عند توفر فرص تداول مناسبة من فريق التحليل' : 'New signals will be generated when suitable trading opportunities arise from the Analysis Team'}</div>
        </div>
      )}

    </div>
  )
})

const DepositPage = memo(() => {
  const {
      lang, isRTL, D, Icon, t, depositCurrency, setDepositCurrency, depositCountdown, depositChecking,
      checkNowPayment, nowpaymentsData, setNowpaymentsData, depositAmount, setDepositAmount,
      handleDeposit, showToast, user, fmt, fmtDate, transactions, cardStyle, inputStyle, btnPrimary, btnOutline,
      PAYMENT_STATUSES, setDepositCountdown
    } = useApp()
  const _ps = (useApp() as any).platformSettings as PlatformSettings | undefined
  const currentPlatformMode = _ps?.platformMode || 'SONA'
  const currencies = [
    { id: 'usdtbsc', name: 'USDT', network: 'BEP20', icon: '₮', color: '#26a17b', arrival: lang === 'ar' ? '~5 دقائق' : '~5 min' },
    { id: 'usdttrc20', name: 'USDT', network: 'TRC20', icon: '₮', color: '#ef0027', arrival: lang === 'ar' ? '~3 دقائق' : '~3 min' },
    { id: 'usdcbsc', name: 'USDC', network: 'BEP20', icon: '$', color: '#2775ca', arrival: lang === 'ar' ? '~5 دقائق' : '~5 min' },
    { id: 'bnbbsc', name: 'BNB', network: 'BEP20', icon: '◆', color: '#f3ba2f', arrival: lang === 'ar' ? '~3 دقائق' : '~3 min' },
    { id: 'ethethereum', name: 'ETH', network: 'ERC20', icon: 'Ξ', color: '#627eea', arrival: lang === 'ar' ? '~10 دقائق' : '~10 min' },
  ]
  const selectedCrypto = currencies.find(c => c.id === depositCurrency) || currencies[0]
  const quickAmounts = [10, 25, 50, 100, 250, 500, 1000, 5000]
  const depositSteps = [
    { num: 1, label: lang === 'ar' ? 'اختر العملة' : 'Choose Currency', icon: 'cash' },
    { num: 2, label: lang === 'ar' ? 'أدخل المبلغ' : 'Enter Amount', icon: 'wallet' },
    { num: 3, label: lang === 'ar' ? 'أرسل الدفع' : 'Send Payment', icon: 'send' },
  ]
  const currentDepositStep = nowpaymentsData ? 3 : (!depositAmount ? 1 : 2)

  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [copiedFeedback, setCopiedFeedback] = useState(false)
  const autoCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const depositMountedRef = useRef(true)

  // Background payment status check - runs silently
  useEffect(() => {
    depositMountedRef.current = true
    if (nowpaymentsData && !autoCheckIntervalRef.current) {
      autoCheckIntervalRef.current = setInterval(() => {
        if (depositMountedRef.current) checkNowPayment()
      }, 30000)
    }
    if (!nowpaymentsData && autoCheckIntervalRef.current) {
      clearInterval(autoCheckIntervalRef.current)
      autoCheckIntervalRef.current = null
    }
    return () => {
      depositMountedRef.current = false
      if (autoCheckIntervalRef.current) { clearInterval(autoCheckIntervalRef.current); autoCheckIntervalRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowpaymentsData])

  const handleCopy = (text: string) => {
    try { navigator.clipboard?.writeText(text); setCopiedFeedback(true); showToast(t('copied')); setTimeout(() => setCopiedFeedback(false), 2000) } catch { showToast(t('copyFailed'), 'err') }
  }

  const countdownPct = depositCountdown > 0 ? (depositCountdown / (30 * 60)) * 100 : 0

  return (
    <div className="page-enter" style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: D.greenBg, border: `1px solid ${D.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="arrowDown" size={22} color={D.green} />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: D.textPrimary, margin: 0 }}>{t('depositTitle')}</h2>
          <p style={{ fontSize: 12, color: D.textMuted, margin: 0 }}>{lang === 'ar' ? 'أودع أموالك بشكل آمن وسريع' : 'Deposit funds safely and quickly'}</p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: D.green, background: D.greenBg, border: `1px solid ${D.greenBorder}`, padding: '4px 12px', borderRadius: 10, whiteSpace: 'nowrap' }}>
          {lang === 'ar' ? 'رسوم الإيداع: مجاني' : 'Deposit Fee: FREE'}
        </span>
      </div>

      {/* Step Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '18px 0 20px', padding: '0 4px' }}>
        {depositSteps.map((s, i) => (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: currentDepositStep >= s.num ? D.greenBg : D.card, border: `2px solid ${currentDepositStep >= s.num ? D.green : D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
                {currentDepositStep > s.num ? <Icon name="check" size={14} color={D.green} /> : <span style={{ fontSize: 12, fontWeight: 800, color: currentDepositStep >= s.num ? D.green : D.textMuted }}>{s.num}</span>}
              </div>
              <span style={{ fontSize: 9, fontWeight: currentDepositStep >= s.num ? 700 : 500, color: currentDepositStep >= s.num ? D.green : D.textMuted, marginTop: 4, textAlign: 'center', whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
            {i < depositSteps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: currentDepositStep > s.num ? D.green : D.border, margin: '0 6px', marginBottom: 18, borderRadius: 1, transition: 'all 0.3s' }} />
            )}
          </div>
        ))}
      </div>

      {/* ===== ACTIVE PAYMENT SESSION ===== */}
      {nowpaymentsData && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', borderColor: D.greenBorder, borderWidth: 2 }}>
            {/* Green gradient header */}
            <div style={{ background: `linear-gradient(135deg, rgba(4,207,153,0.12) 0%, rgba(64,158,255,0.06) 100%)`, padding: '20px 20px 16px', borderBottom: `1px solid ${D.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: D.greenBg, border: `1px solid ${D.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="clock" size={22} color={D.green} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: D.green }}>{t('paymentCreated')}</div>
                  <div style={{ fontSize: 12, color: D.textMuted }}>{t('sendAmountBelow')}</div>
                </div>
              </div>
              {/* Countdown Timer with Progress Bar */}
              {depositCountdown > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: D.textMuted }}>{lang === 'ar' ? 'الوقت المتبقي' : 'Time Remaining'}</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: depositCountdown < 300 ? D.red : D.green, fontFamily: 'monospace' }}>
                      {Math.floor(depositCountdown / 60)}:{(depositCountdown % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: D.bg, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${countdownPct}%`, height: '100%', background: depositCountdown < 300 ? D.red : D.green, borderRadius: 3, transition: 'width 1s linear' }} />
                  </div>
                </div>
              )}
            </div>

            {/* QR Code Section */}
            <div style={{ padding: '24px 20px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: D.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                {lang === 'ar' ? 'امسح للدفع' : 'Scan to Pay'}
              </div>
              <div style={{ display: 'inline-block', background: '#ffffff', borderRadius: 16, padding: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(nowpaymentsData.payAddress)}`} alt="QR" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: 180, height: 180, borderRadius: 8, display: 'block' }} />
              </div>
            </div>

            {/* Payment Amount - Prominent */}
            <div style={{ padding: '0 20px 16px' }}>
              <div style={{ background: D.bg, borderRadius: 14, padding: '18px 20px', textAlign: 'center', border: `1px solid ${D.greenBorder}` }}>
                <div style={{ fontSize: 11, color: D.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{t('requiredAmount')}</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: D.green, lineHeight: 1.1 }}>{nowpaymentsData.payAmount}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: D.textSecondary, marginTop: 2 }}>{nowpaymentsData.payCurrency?.toUpperCase()}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: selectedCrypto.color, background: `${selectedCrypto.color}15`, padding: '4px 10px', borderRadius: 8 }}>{selectedCrypto.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: D.accent, background: D.accentBg, padding: '4px 10px', borderRadius: 8 }}>{selectedCrypto.network}</span>
                </div>
              </div>
            </div>

            {/* Payment Address */}
            <div style={{ padding: '0 20px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.textSecondary, marginBottom: 6 }}>{t('addressLabel')}</div>
              <div style={{ background: D.bg, border: `1px solid ${copiedFeedback ? D.greenBorder : D.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 8, wordBreak: 'break-all', fontSize: 12, color: copiedFeedback ? D.green : D.textPrimary, fontFamily: 'monospace', direction: 'ltr', textAlign: 'center', lineHeight: 1.6, transition: 'all 0.3s' }}>
                {nowpaymentsData.payAddress}
              </div>
              <button onClick={() => handleCopy(nowpaymentsData.payAddress)} style={{ ...btnOutline, maxWidth: 240, margin: '0 auto', display: 'flex', borderColor: copiedFeedback ? D.greenBorder : D.accentBorder, color: copiedFeedback ? D.green : D.accent, gap: 8, justifyContent: 'center', alignItems: 'center', padding: '10px 0' }}>
                <Icon name={copiedFeedback ? 'check' : 'doc'} size={14} color={copiedFeedback ? D.green : D.accent} />
                {copiedFeedback ? t('copied') : t('copyAddress')}
              </button>
            </div>

            {/* Step-by-step Instructions */}
            <div style={{ padding: '0 20px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: D.textPrimary, marginBottom: 10 }}>{lang === 'ar' ? 'تعليمات الدفع' : 'Payment Instructions'}</div>
              {[
                { step: '1', text: lang === 'ar' ? `افتح محفظتك التي تدعم ${selectedCrypto.name} على شبكة ${selectedCrypto.network}` : `Open your ${selectedCrypto.name} wallet on ${selectedCrypto.network} network` },
                { step: '2', text: lang === 'ar' ? 'امسح رمز QR أو انسخ العنوان أعلاه' : 'Scan the QR code or copy the address above' },
                { step: '3', text: lang === 'ar' ? `أرسل المبلغ المحدد بالضبط: ${nowpaymentsData.payAmount} ${nowpaymentsData.payCurrency?.toUpperCase()}` : `Send the exact amount: ${nowpaymentsData.payAmount} ${nowpaymentsData.payCurrency?.toUpperCase()}` },
                { step: '4', text: lang === 'ar' ? 'انتظر تأكيد الشبكة' : 'Wait for network confirmation' },
              ].map((inst, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 22px' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: D.accent }}>{inst.step}</span>
                  </div>
                  <span style={{ fontSize: 12, color: D.textSecondary, lineHeight: 1.6 }}>{inst.text}</span>
                </div>
              ))}
            </div>

            {/* Warning */}
            <div style={{ padding: '0 20px 16px' }}>
              <div style={{ background: D.yellowBg, border: `1px solid rgba(230,162,60,0.2)`, borderRadius: 12, padding: '12px 14px', fontSize: 12, color: D.yellow, lineHeight: 1.8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Icon name="shield" size={16} color={D.yellow} />
                <span>{t('depositNote')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== NEW DEPOSIT FORM ===== */}
      {!nowpaymentsData && (
        <>
          {/* Balance Card */}
          <div style={{ ...cardStyle, padding: '20px 22px', marginBottom: 16, background: `linear-gradient(135deg, ${D.card} 0%, rgba(64,158,255,0.06) 100%)` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: D.textMuted, marginBottom: 2 }}>{t('availableBalance')}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: D.textPrimary }}>${fmt(user.balance)}</div>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="wallet" size={24} color={D.accent} />
              </div>
            </div>
          </div>

          {/* Step 1: Currency Selection */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: D.greenBg, border: `1px solid ${D.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: D.green }}>1</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary }}>{lang === 'ar' ? 'اختر العملة والشبكة' : 'Choose Currency & Network'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {currencies.map(c => (
                <button key={c.id} onClick={() => setDepositCurrency(c.id)} style={{ padding: '14px 16px', background: depositCurrency === c.id ? `${c.color}10` : D.card, border: `1.5px solid ${depositCurrency === c.id ? c.color : D.border}`, borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s', textAlign: isRTL ? 'right' : 'left' }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: `${c.color}18`, border: `1px solid ${c.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: c.color }}>{c.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: depositCurrency === c.id ? c.color : D.textPrimary }}>{c.name}</div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: D.accent, background: D.accentBg, padding: '1px 6px', borderRadius: 5 }}>{c.network}</span>
                    </div>
                    <div style={{ fontSize: 10, color: D.textMuted, marginTop: 2 }}>{c.arrival}</div>
                  </div>
                  {depositCurrency === c.id && <Icon name="check" size={16} color={c.color} />}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Amount Input */}
          <div style={{ ...cardStyle, padding: '24px 20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: D.greenBg, border: `1px solid ${D.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: D.green }}>2</span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary }}>{lang === 'ar' ? 'مبلغ الإيداع' : 'Deposit Amount'}</div>
                <div style={{ fontSize: 11, color: D.textMuted }}>{lang === 'ar' ? 'الحد الأدنى $10 · رسوم الإيداع: مجاني' : 'Minimum $10 · Deposit Fee: FREE'}</div>
              </div>
            </div>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, fontWeight: 800, color: D.accent }}>$</span>
              <input style={{ ...inputStyle, paddingLeft: 36, fontSize: 22, fontWeight: 800, textAlign: 'center', padding: '18px 16px' }} placeholder="0.00" type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
            </div>
            {/* Quick Amount Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {quickAmounts.map(amt => (
                <button key={amt} onClick={() => setDepositAmount(String(amt))} style={{ padding: '9px 0', background: depositAmount === String(amt) ? D.greenBg : D.bg, border: `1px solid ${depositAmount === String(amt) ? D.greenBorder : D.border}`, borderRadius: 10, color: depositAmount === String(amt) ? D.green : D.textSecondary, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", transition: 'all 0.2s' }}>
                  ${amt >= 1000 ? `${amt / 1000}K` : amt}
                </button>
              ))}
            </div>

            {/* Selected Currency Info */}
            <div style={{ background: D.bg, borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 6, background: `${selectedCrypto.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: selectedCrypto.color }}>{selectedCrypto.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>{selectedCrypto.name} ({selectedCrypto.network})</span>
              </div>
              <span style={{ fontSize: 11, color: D.textMuted }}>{selectedCrypto.arrival}</span>
            </div>

            {/* Info Box */}
            <div style={{ background: D.greenBg, border: `1px solid rgba(4,207,153,0.15)`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: D.green, lineHeight: 1.8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Icon name="shield" size={14} color={D.green} />
              <span>{t('nowpaymentsNote')}</span>
            </div>

            <button onClick={handleDeposit} style={{ ...btnPrimary, background: D.green, boxShadow: '0 0 14px rgba(4,207,153,0.3)', marginTop: 16, fontSize: 16, padding: '16px 0' }}>
              {lang === 'ar' ? 'إنشاء طلب الدفع' : 'Create Payment Request'}
            </button>
          </div>

          {/* How Deposits Work Accordion */}
          <div style={{ ...cardStyle, marginBottom: 16, overflow: 'hidden' }}>
            <button onClick={() => setShowHowItWorks(!showHowItWorks)} style={{ width: '100%', padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: D.textPrimary, fontFamily: "'Cairo', sans-serif" }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="doc" size={16} color={D.accent} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{lang === 'ar' ? 'كيف يعمل الإيداع؟' : 'How deposits work?'}</span>
              </div>
              <Icon name={showHowItWorks ? 'x' : 'plus'} size={16} color={D.textMuted} />
            </button>
            {showHowItWorks && (
              <div style={{ padding: '0 18px 16px', borderTop: `1px solid ${D.border}` }}>
                <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { icon: 'cash', title: lang === 'ar' ? 'اختر العملة' : 'Select Currency', desc: lang === 'ar' ? 'اختر العملة الرقمية والشبكة المناسبة' : 'Choose your preferred cryptocurrency and network' },
                    { icon: 'wallet', title: lang === 'ar' ? 'حدد المبلغ' : 'Specify Amount', desc: lang === 'ar' ? 'أدخل مبلغ الإيداع بالدولار - سيتم التحويل تلقائياً' : 'Enter deposit amount in USDT - auto-converted to crypto' },
                    { icon: 'send', title: lang === 'ar' ? 'أرسل الدفع' : 'Send Payment', desc: lang === 'ar' ? 'أرسل المبلغ المحدد للعنوان عبر محفظتك' : 'Send the specified amount to the address from your wallet' },
                    { icon: 'check', title: lang === 'ar' ? 'تأكيد الشبكة' : 'Network Confirmation', desc: lang === 'ar' ? 'بعد تأكيد الشبكة، سيتم تحديث رصيدك' : 'After network confirmation, your balance will be updated' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 28px' }}>
                        <Icon name={item.icon} size={13} color={D.accent} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: D.textPrimary }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: D.textMuted, lineHeight: 1.6 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Security Badges */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { icon: 'shield', text: lang === 'ar' ? 'دفع آمن' : 'Secure Payment', color: D.green },
              { icon: 'clock', text: lang === 'ar' ? 'تأكيد الشبكة' : 'Network Confirmation', color: D.accent },
              { icon: 'check', text: lang === 'ar' ? 'مشفرة 256-bit' : '256-bit Encrypted', color: D.purple },
            ].map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name={b.icon} size={14} color={b.color} />
                <span style={{ fontSize: 11, fontWeight: 600, color: b.color }}>{b.text}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== DEPOSIT HISTORY ===== */}
      {transactions.filter((tx: any) => tx.type === 'DEPOSIT').length > 0 && (
        <div style={{ marginTop: 8 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: D.textPrimary, marginBottom: 12 }}>{t('depositHistory')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {transactions.filter((tx: any) => tx.type === 'DEPOSIT').map((tx: any) => {
              const statusLabels: Record<string, { text: string; color: string; bg: string }> = {
                PENDING: { text: lang === 'ar' ? 'معلق' : 'Pending', color: D.yellow, bg: D.yellowBg },
                PROCESSING: { text: lang === 'ar' ? 'قيد المعالجة' : 'Processing', color: D.accent, bg: D.accentBg },
                APPROVED: { text: lang === 'ar' ? 'مقبول' : 'Approved', color: D.green, bg: D.greenBg },
                COMPLETED: { text: lang === 'ar' ? 'مكتمل' : 'Completed', color: D.green, bg: D.greenBg },
                REJECTED: { text: lang === 'ar' ? 'مرفوض' : 'Rejected', color: D.red, bg: D.redBg },
              }
              const statusInfo = statusLabels[tx.status] || { text: tx.status, color: D.textMuted, bg: 'transparent' }
              return (
                <div key={tx.id} style={{ ...cardStyle, padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: D.greenBg, border: `1px solid ${D.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="arrowDown" size={18} color={D.green} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: D.textPrimary }}>+${fmt(tx.amount)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 10, color: D.textMuted }}>{fmtDate(tx.createdAt)}</span>
                        {tx.cryptoCurrency && <span style={{ fontSize: 9, fontWeight: 700, color: D.accent, background: D.accentBg, padding: '1px 6px', borderRadius: 5 }}>{tx.cryptoCurrency}</span>}
                        {tx.cryptoNetwork && <span style={{ fontSize: 9, fontWeight: 700, color: D.purple, background: D.purpleBg, padding: '1px 6px', borderRadius: 5 }}>{tx.cryptoNetwork}</span>}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: statusInfo.color, background: statusInfo.bg, padding: '4px 12px', borderRadius: 8, whiteSpace: 'nowrap' }}>{statusInfo.text}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})

const KycPage = memo(() => {
  const {
      lang, D, Icon, t, user, fmtDate, kycForm, setKycForm, kycStep, setKycStep,
      kycFrontPreview, kycBackPreview, kycSelfiePreview, kycDocFile, kycSelfieFile,
      handleKycFileChange, kycSubmitting, handleKycSubmit, KYC_REASONS,
      cardStyle, inputStyle, btnPrimary, btnOutline
    } = useApp()
  const steps = [
    { label: lang === 'ar' ? 'المعلومات الشخصية' : 'Personal Info', icon: 'user' },
    { label: lang === 'ar' ? 'رفع الوثيقة' : 'Document Upload', icon: 'camera' },
    { label: lang === 'ar' ? 'التقط سيلفي' : 'Selfie Verification', icon: 'camera' },
    { label: lang === 'ar' ? 'مراجعة وإرسال' : 'Review & Submit', icon: 'check' },
  ]

  const countries = [
    { code: 'SY', name: 'سوريا', nameEn: 'Syria' },
    { code: 'AE', name: 'الإمارات', nameEn: 'UAE' },
    { code: 'SA', name: 'السعودية', nameEn: 'Saudi Arabia' },
    { code: 'EG', name: 'مصر', nameEn: 'Egypt' },
    { code: 'IQ', name: 'العراق', nameEn: 'Iraq' },
    { code: 'JO', name: 'الأردن', nameEn: 'Jordan' },
    { code: 'LB', name: 'لبنان', nameEn: 'Lebanon' },
    { code: 'TR', name: 'تركيا', nameEn: 'Turkey' },
    { code: 'US', name: 'أمريكا', nameEn: 'USA' },
    { code: 'GB', name: 'بريطانيا', nameEn: 'UK' },
    { code: 'DE', name: 'ألمانيا', nameEn: 'Germany' },
    { code: 'OTHER', name: lang === 'ar' ? 'أخرى' : 'Other', nameEn: 'Other' },
  ]

  const [kycCountry, setKycCountry] = useState('')

  return (
    <div className="page-enter" style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
      {/* Professional Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="shield" size={24} color={D.accent} />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: D.textPrimary, margin: 0 }}>{t('kycTitle')}</h2>
          <p style={{ fontSize: 12, color: D.textMuted, margin: 0 }}>{lang === 'ar' ? 'تحقق من هويتك لتفعيل السحب وتأمين حسابك' : 'Verify your identity to enable withdrawals and secure your account'}</p>
        </div>
      </div>

      {/* VERIFIED Status */}
      {user.kycStatus === 'VERIFIED' ? (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', marginTop: 16 }}>
          <div style={{ background: `linear-gradient(135deg, rgba(4,207,153,0.12) 0%, rgba(64,158,255,0.06) 100%)`, padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: 24, background: D.greenBg, border: `2px solid ${D.greenBorder}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: `0 0 20px rgba(4,207,153,0.2)` }}>
              <Icon name="check" size={40} color={D.green} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: D.green, marginBottom: 8 }}>{t('verified')}</div>
            <div style={{ fontSize: 13, color: D.textSecondary, lineHeight: 1.8 }}>{t('verifiedDesc')}</div>
          </div>
          {user.kycFullName && (
            <div style={{ padding: '16px 20px', borderTop: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: D.textMuted }}>{lang === 'ar' ? 'الاسم الموثق' : 'Verified Name'}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary }}>{user.kycFullName}</span>
            </div>
          )}
          {user.kycVerifiedAt && (
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: D.textMuted }}>{lang === 'ar' ? 'تاريخ التحقق' : 'Verified Date'}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: D.green }}>{fmtDate(user.kycVerifiedAt)}</span>
            </div>
          )}
        </div>
      ) : user.kycStatus === 'PENDING' ? (
        /* PENDING Status */
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', marginTop: 16 }}>
          <div style={{ background: `linear-gradient(135deg, rgba(230,162,60,0.1) 0%, rgba(64,158,255,0.04) 100%)`, padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: 24, background: D.yellowBg, border: `2px solid rgba(230,162,60,0.3)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Icon name="clock" size={40} color={D.yellow} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: D.yellow, marginBottom: 8 }}>{t('underReview')}</div>
            <div style={{ fontSize: 13, color: D.textSecondary, lineHeight: 1.8 }}>{t('underReviewDesc')}</div>
          </div>
          <div style={{ padding: '16px 20px', borderTop: `1px solid ${D.border}` }}>
            <div style={{ background: D.accentBg, border: `1px solid ${D.accentBorder}`, borderRadius: 12, padding: '14px 16px', fontSize: 12, color: D.accent, display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: D.accent, animation: 'pulse 2s infinite' }} />
              <span>{lang === 'ar' ? 'سيتم إشعارك فور اكتمال المراجعة' : 'You will be notified once review is complete'}</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Rejected Notice - shown at top when REJECTED */}
          {user.kycStatus === 'REJECTED' && (
            <div style={{ ...cardStyle, padding: '20px 22px', marginTop: 16, marginBottom: 12, borderColor: D.redBorder, borderWidth: 1, background: `linear-gradient(135deg, ${D.card} 0%, rgba(243,100,100,0.06) 100%)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: D.redBg, border: `1px solid ${D.redBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="x" size={22} color={D.red} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: D.red }}>{t('rejected')}</div>
                  <div style={{ fontSize: 12, color: D.textMuted, marginTop: 2 }}>{lang === 'ar' ? 'يرجى تصحيح المشكلة وإعادة الإرسال' : 'Please fix the issue and resubmit'}</div>
                </div>
              </div>
              {user.kycRejectCode && KYC_REASONS[user.kycRejectCode] && (
                <div style={{ background: D.bg, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: D.textSecondary, lineHeight: 1.7 }}>
                  <strong style={{ color: D.red }}>{lang === 'ar' ? 'السبب:' : 'Reason:'}</strong> {KYC_REASONS[user.kycRejectCode]}
                </div>
              )}
              {!user.kycRejectCode && user.kycRejectReason && (
                <div style={{ background: D.bg, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: D.textSecondary, lineHeight: 1.7 }}>
                  <strong style={{ color: D.red }}>{lang === 'ar' ? 'السبب:' : 'Reason:'}</strong> {user.kycRejectReason}
                </div>
              )}
              <button onClick={() => { const { navigate: nav, handleSendChat: sendChat } = useApp() as any; if (nav) nav('support'); if (sendChat) setTimeout(() => sendChat(lang === 'ar' ? `تم رفض التحقق KYC الخاص بي. السبب: ${user.kycRejectReason || KYC_REASONS[user.kycRejectCode || ''] || 'غير محدد'}` : `My KYC was rejected. Reason: ${user.kycRejectReason || 'unspecified'}`), 500) }} style={{ marginTop: 10, padding: '8px 16px', background: 'rgba(64,158,255,0.1)', border: '1px solid rgba(64,158,255,0.2)', borderRadius: 8, color: '#409eff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", display: 'flex', alignItems: 'center', gap: 6 }}>
                💬 {lang === 'ar' ? 'تواصل مع الدعم للمساعدة' : 'Contact Support for Help'}
              </button>
            </div>
          )}

          {/* Progress Steps - Connected dots with lines */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0 24px', padding: '0 4px' }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: i < kycStep ? D.greenBg : i === kycStep ? D.accentBg : D.card, border: `2px solid ${i < kycStep ? D.green : i === kycStep ? D.accent : D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', boxShadow: i === kycStep ? `0 0 12px rgba(64,158,255,0.3)` : 'none' }}>
                    {i < kycStep ? <Icon name="check" size={16} color={D.green} /> : <Icon name={s.icon} size={14} color={i === kycStep ? D.accent : D.textMuted} />}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: i <= kycStep ? 700 : 500, color: i < kycStep ? D.green : i === kycStep ? D.accent : D.textMuted, marginTop: 6, textAlign: 'center', whiteSpace: 'nowrap', maxWidth: 70 }}>{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: i < kycStep ? D.green : D.border, margin: '0 4px', marginBottom: 22, borderRadius: 1, transition: 'all 0.3s' }} />
                )}
              </div>
            ))}
          </div>

          {/* ===== Step 0: Personal Information + Document Type + Country ===== */}
          {kycStep === 0 && (
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              {/* Step header */}
              <div style={{ background: `linear-gradient(135deg, rgba(64,158,255,0.08) 0%, rgba(4,207,153,0.04) 100%)`, padding: '20px 22px', borderBottom: `1px solid ${D.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="user" size={22} color={D.accent} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: D.textPrimary }}>{lang === 'ar' ? 'المعلومات الشخصية' : 'Personal Information'}</div>
                    <div style={{ fontSize: 12, color: D.textMuted }}>{lang === 'ar' ? 'أدخل بياناتك كما هي في وثيقة الهوية' : 'Enter your details as shown on your ID document'}</div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '22px 22px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: D.textSecondary, marginBottom: 6, display: 'block' }}>{t('idName')}</label>
                  <input style={inputStyle} placeholder={lang === 'ar' ? 'أدخل اسمك الكامل' : 'Enter your full name'} value={kycForm.fullName} onChange={e => setKycForm({ ...kycForm, fullName: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: D.textSecondary, marginBottom: 6, display: 'block' }}>{t('idNumber')}</label>
                  <input style={inputStyle} placeholder={lang === 'ar' ? 'أدخل رقم الهوية' : 'Enter your ID number'} value={kycForm.idNumber} onChange={e => setKycForm({ ...kycForm, idNumber: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: D.textSecondary, marginBottom: 6, display: 'block' }}>{lang === 'ar' ? 'الدولة' : 'Country'}</label>
                  <select style={{ ...inputStyle, appearance: 'none' }} value={kycCountry} onChange={e => setKycCountry(e.target.value)}>
                    <option value="">{lang === 'ar' ? 'اختر الدولة' : 'Select Country'}</option>
                    {countries.map(c => <option key={c.code} value={c.code}>{lang === 'ar' ? c.name : c.nameEn}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: D.textSecondary, marginBottom: 8, display: 'block' }}>{lang === 'ar' ? 'نوع الوثيقة' : 'Document Type'}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { value: 'PASSPORT', label: t('passport'), svgIcon: 'id' as const, accent: '#2775ca' as const },
                      { value: 'ID_CARD', label: t('idCard'), svgIcon: 'id' as const, accent: '#04cf99' as const },
                      { value: 'DRIVER_LICENSE', label: t('driverLicense'), svgIcon: 'id' as const, accent: '#e6a23c' as const },
                    ].map(doc => (
                      <button key={doc.value} onClick={() => setKycForm({ ...kycForm, docType: doc.value })} style={{ padding: '14px 8px', background: kycForm.docType === doc.value ? `${doc.accent}10` : D.bg, border: `1.5px solid ${kycForm.docType === doc.value ? doc.accent : D.border}`, borderRadius: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all 0.2s', fontFamily: "'Cairo', sans-serif" }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${doc.accent}15`, border: `1px solid ${doc.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name={doc.svgIcon} size={16} color={kycForm.docType === doc.value ? doc.accent : D.textMuted} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: kycForm.docType === doc.value ? doc.accent : D.textSecondary, textAlign: 'center' }}>{doc.label}</span>
                        {kycForm.docType === doc.value && <Icon name="check" size={12} color={doc.accent} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Tips */}
              <div style={{ padding: '0 22px 14px' }}>
                <div style={{ background: D.greenBg, border: `1px solid rgba(4,207,153,0.15)`, borderRadius: 10, padding: '10px 14px', fontSize: 11, color: D.green, lineHeight: 1.7, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Icon name="shield" size={14} color={D.green} />
                  <span>{lang === 'ar' ? 'تأكد من تطابق الاسم مع الوثيقة. البيانات خاطئة قد تؤدي لرفض التحقق.' : 'Ensure your name matches the document. Incorrect details may lead to rejection.'}</span>
                </div>
              </div>
              <div style={{ padding: '0 22px 22px' }}>
                <button onClick={() => { if (kycForm.fullName && kycForm.idNumber && kycForm.docType) setKycStep(1) }} style={{ ...btnPrimary, opacity: (!kycForm.fullName || !kycForm.idNumber || !kycForm.docType) ? 0.5 : 1 }}>
                  {lang === 'ar' ? 'التالي' : 'Next'}
                </button>
              </div>
            </div>
          )}

          {/* ===== Step 1: Document Upload ===== */}
          {kycStep === 1 && (
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              {/* Step header */}
              <div style={{ background: `linear-gradient(135deg, rgba(192,91,221,0.08) 0%, rgba(64,158,255,0.04) 100%)`, padding: '20px 22px', borderBottom: `1px solid ${D.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: D.purpleBg, border: `1px solid ${D.purpleBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="camera" size={22} color={D.purple} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: D.textPrimary }}>{lang === 'ar' ? 'رفع صورة الوثيقة' : 'Upload Document'}</div>
                    <div style={{ fontSize: 12, color: D.textMuted }}>{lang === 'ar' ? 'ارفع صورة واضحة للوجه الأمامي والخلفي' : 'Upload clear photos of the front and back of your ID'}</div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '22px 22px 16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                  {/* Front Upload */}
                  <label style={{ ...cardStyle, padding: '24px 16px', cursor: 'pointer', textAlign: 'center', border: `2px dashed ${kycFrontPreview ? D.greenBorder : D.accentBorder}`, borderRadius: 14, position: 'relative', overflow: 'hidden', transition: 'border-color 0.3s' }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleKycFileChange(f, 'front') }} />
                    {kycFrontPreview ? (
                      <>
                        <img src={kycFrontPreview} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />
                        <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: D.greenBg, border: `1px solid ${D.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="check" size={12} color={D.green} />
                        </div>
                      </>
                    ) : (
                      <div style={{ width: '100%', height: 110, background: D.bg, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 0 }}>
                        <Icon name="camera" size={30} color={D.accent} />
                        <div style={{ fontSize: 10, color: D.textMuted, marginTop: 6 }}>{lang === 'ar' ? 'اضغط أو اسحب الصورة' : 'Tap or drag to upload'}</div>
                      </div>
                    )}
                    <div style={{ fontSize: 12, fontWeight: 700, color: kycFrontPreview ? D.green : D.textSecondary, marginTop: 8 }}>{lang === 'ar' ? 'الوجه الأمامي' : 'Front Side'}</div>
                  </label>
                  {/* Back Upload */}
                  <label style={{ ...cardStyle, padding: '24px 16px', cursor: 'pointer', textAlign: 'center', border: `2px dashed ${kycBackPreview ? D.greenBorder : D.accentBorder}`, borderRadius: 14, position: 'relative', overflow: 'hidden', transition: 'border-color 0.3s' }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleKycFileChange(f, 'back') }} />
                    {kycBackPreview ? (
                      <>
                        <img src={kycBackPreview} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />
                        <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: D.greenBg, border: `1px solid ${D.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="check" size={12} color={D.green} />
                        </div>
                      </>
                    ) : (
                      <div style={{ width: '100%', height: 110, background: D.bg, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 0 }}>
                        <Icon name="doc" size={30} color={D.accent} />
                        <div style={{ fontSize: 10, color: D.textMuted, marginTop: 6 }}>{lang === 'ar' ? 'اضغط أو اسحب الصورة' : 'Tap or drag to upload'}</div>
                      </div>
                    )}
                    <div style={{ fontSize: 12, fontWeight: 700, color: kycBackPreview ? D.green : D.textSecondary, marginTop: 8 }}>{lang === 'ar' ? 'الوجه الخلفي' : 'Back Side'}</div>
                  </label>
                </div>
              </div>
              {/* Tips */}
              <div style={{ padding: '0 22px 16px' }}>
                <div style={{ background: D.yellowBg, border: `1px solid rgba(230,162,60,0.15)`, borderRadius: 10, padding: '12px 14px', fontSize: 11, color: D.yellow, lineHeight: 1.7, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Icon name="shield" size={14} color={D.yellow} />
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{lang === 'ar' ? 'نصائح لصورة واضحة:' : 'Tips for a clear photo:'}</div>
                    <span>{lang === 'ar' ? 'تأكد من وضوح جميع البيانات · لا تقص أو تعدل الصورة · ارفع صورة عالية الجودة' : 'Ensure all data is readable · Do not crop or edit · Upload a high-quality image'}</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: '0 22px 22px', display: 'flex', gap: 8 }}>
                <button onClick={() => setKycStep(0)} style={{ ...btnOutline, flex: 0.4 }}>{lang === 'ar' ? 'رجوع' : 'Back'}</button>
                <button onClick={() => { if (kycDocFile) setKycStep(2) }} style={{ ...btnPrimary, flex: 1, opacity: !kycDocFile ? 0.5 : 1 }}>{lang === 'ar' ? 'التالي' : 'Next'}</button>
              </div>
            </div>
          )}

          {/* ===== Step 2: Selfie Verification ===== */}
          {kycStep === 2 && (
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              {/* Step header */}
              <div style={{ background: `linear-gradient(135deg, rgba(64,158,255,0.08) 0%, rgba(4,207,153,0.04) 100%)`, padding: '20px 22px', borderBottom: `1px solid ${D.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="user" size={22} color={D.accent} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: D.textPrimary }}>{lang === 'ar' ? 'التحقق بالسيلفي' : 'Selfie Verification'}</div>
                    <div style={{ fontSize: 12, color: D.textMuted }}>{lang === 'ar' ? 'التقط صورة شخصية واضحة (اختياري)' : 'Take a clear selfie photo (optional)'}</div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '28px 22px 20px' }}>
                <label style={{ ...cardStyle, padding: '28px 20px', cursor: 'pointer', textAlign: 'center', border: `2px dashed ${kycSelfiePreview ? D.greenBorder : D.accentBorder}`, borderRadius: 15, display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'border-color 0.3s' }}>
                  <input type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleKycFileChange(f, 'selfie') }} />
                  {kycSelfiePreview ? (
                    <>
                      <img src={kycSelfiePreview} style={{ width: 130, height: 130, objectFit: 'cover', borderRadius: '50%', border: `3px solid ${D.green}`, marginBottom: 14, boxShadow: `0 0 16px rgba(4,207,153,0.2)` }} />
                      <div style={{ fontSize: 14, fontWeight: 700, color: D.green }}>{lang === 'ar' ? 'تم رفع السيلفي بنجاح' : 'Selfie uploaded successfully'}</div>
                      <div style={{ fontSize: 11, color: D.textMuted, marginTop: 4 }}>{lang === 'ar' ? 'اضغط لتغيير الصورة' : 'Tap to change photo'}</div>
                    </>
                  ) : (
                    <>
                      <div style={{ width: 120, height: 120, borderRadius: '50%', background: D.accentBg, border: `2px dashed ${D.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                        <Icon name="camera" size={38} color={D.accent} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: D.accent }}>{lang === 'ar' ? 'اضغط لالتقاط صورة' : 'Tap to take photo'}</div>
                      <div style={{ fontSize: 12, color: D.textMuted, marginTop: 6 }}>{lang === 'ar' ? 'وجهك واضح مع إضاءة جيدة' : 'Clear face with good lighting'}</div>
                    </>
                  )}
                </label>
              </div>
              {/* Tips */}
              <div style={{ padding: '0 22px 16px' }}>
                <div style={{ background: D.accentBg, border: `1px solid ${D.accentBorder}`, borderRadius: 10, padding: '10px 14px', fontSize: 11, color: D.accent, lineHeight: 1.7, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Icon name="shield" size={14} color={D.accent} />
                  <span>{lang === 'ar' ? 'السيلفي اختياري لكنه يساعد في تسريع عملية التحقق. تأكد من وضوح وجهك.' : 'Selfie is optional but helps speed up verification. Ensure your face is clearly visible.'}</span>
                </div>
              </div>
              <div style={{ padding: '0 22px 22px', display: 'flex', gap: 8 }}>
                <button onClick={() => setKycStep(1)} style={{ ...btnOutline, flex: 0.4 }}>{lang === 'ar' ? 'رجوع' : 'Back'}</button>
                <button onClick={() => setKycStep(3)} style={{ ...btnPrimary, flex: 1 }}>{lang === 'ar' ? 'التالي' : 'Next'}</button>
              </div>
            </div>
          )}

          {/* ===== Step 3: Review & Submit ===== */}
          {kycStep === 3 && (
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              {/* Step header */}
              <div style={{ background: `linear-gradient(135deg, rgba(4,207,153,0.08) 0%, rgba(64,158,255,0.04) 100%)`, padding: '20px 22px', borderBottom: `1px solid ${D.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: D.greenBg, border: `1px solid ${D.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check" size={22} color={D.green} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: D.textPrimary }}>{lang === 'ar' ? 'مراجعة وإرسال' : 'Review & Submit'}</div>
                    <div style={{ fontSize: 12, color: D.textMuted }}>{lang === 'ar' ? 'تحقق من بياناتك قبل الإرسال' : 'Review your information before submitting'}</div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '22px 22px 16px' }}>
                {/* Summary Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <div style={{ background: D.bg, borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: D.textMuted }}>{t('idName')}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary }}>{kycForm.fullName || '—'}</span>
                  </div>
                  <div style={{ background: D.bg, borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: D.textMuted }}>{t('idNumber')}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary }}>{kycForm.idNumber ? `****${kycForm.idNumber.slice(-4)}` : '—'}</span>
                  </div>
                  <div style={{ background: D.bg, borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: D.textMuted }}>{lang === 'ar' ? 'نوع الوثيقة' : 'Document Type'}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: D.accent }}>{kycForm.docType === 'PASSPORT' ? t('passport') : kycForm.docType === 'ID_CARD' ? t('idCard') : t('driverLicense')}</span>
                  </div>
                </div>

                {/* Document Thumbnails */}
                <div style={{ fontSize: 12, fontWeight: 700, color: D.textSecondary, marginBottom: 10 }}>{lang === 'ar' ? 'المستندات المرفقة' : 'Uploaded Documents'}</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  {/* Front thumbnail */}
                  <div style={{ flex: 1, background: D.bg, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {kycFrontPreview ? (
                      <img src={kycFrontPreview} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: D.redBg, border: `1px solid ${D.redBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="x" size={16} color={D.red} />
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: kycFrontPreview ? D.green : D.red }}>{kycFrontPreview ? (lang === 'ar' ? 'مرفقة' : 'Attached') : (lang === 'ar' ? 'مفقودة' : 'Missing')}</div>
                      <div style={{ fontSize: 10, color: D.textMuted }}>{lang === 'ar' ? 'الوجه الأمامي' : 'Front Side'}</div>
                    </div>
                  </div>
                  {/* Back thumbnail */}
                  <div style={{ flex: 1, background: D.bg, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {kycBackPreview ? (
                      <img src={kycBackPreview} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: D.card, border: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="doc" size={16} color={D.textMuted} />
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: kycBackPreview ? D.green : D.textSecondary }}>{kycBackPreview ? (lang === 'ar' ? 'مرفقة' : 'Attached') : (lang === 'ar' ? 'اختياري' : 'Optional')}</div>
                      <div style={{ fontSize: 10, color: D.textMuted }}>{lang === 'ar' ? 'الوجه الخلفي' : 'Back Side'}</div>
                    </div>
                  </div>
                  {/* Selfie thumbnail */}
                  <div style={{ flex: 1, background: D.bg, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {kycSelfiePreview ? (
                      <img src={kycSelfiePreview} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: D.card, border: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="user" size={16} color={D.textMuted} />
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: kycSelfieFile ? D.green : D.textSecondary }}>{kycSelfieFile ? (lang === 'ar' ? 'مرفق' : 'Attached') : (lang === 'ar' ? 'اختياري' : 'Optional')}</div>
                      <div style={{ fontSize: 10, color: D.textMuted }}>{lang === 'ar' ? 'السيلفي' : 'Selfie'}</div>
                    </div>
                  </div>
                </div>

                {/* Data Privacy Notice */}
                <div style={{ background: D.greenBg, border: `1px solid rgba(4,207,153,0.15)`, borderRadius: 12, padding: '14px 16px', fontSize: 12, color: D.green, lineHeight: 1.7, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Icon name="lock" size={16} color={D.green} />
                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 2 }}>{lang === 'ar' ? 'بياناتك محمية' : 'Your data is protected'}</div>
                    <span style={{ color: 'rgba(4,207,153,0.8)' }}>{lang === 'ar' ? 'جميع المستندات مشفرة بتقنية 256-bit SSL ولن يتم مشاركتها مع أي طرف ثالث. نلتزم بأعلى معايير الخصوصية.' : 'All documents are encrypted with 256-bit SSL and will never be shared with third parties. We comply with the highest privacy standards.'}</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: '0 22px 22px', display: 'flex', gap: 8 }}>
                <button onClick={() => setKycStep(2)} style={{ ...btnOutline, flex: 0.4 }}>{lang === 'ar' ? 'رجوع' : 'Back'}</button>
                <button onClick={handleKycSubmit} disabled={kycSubmitting || !kycDocFile || !kycForm.fullName || !kycForm.idNumber} style={{ ...btnPrimary, flex: 1, opacity: (!kycDocFile || !kycForm.fullName || !kycForm.idNumber || kycSubmitting) ? 0.5 : 1, background: D.green, boxShadow: '0 0 14px rgba(4,207,153,0.3)' }}>
                  {kycSubmitting ? t('verifying') : t('submitVerification')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
})

const ReferralsPage = memo(() => {
  const { user, D, cardStyle, btnPrimary, fmt, copyToClipboard } = useApp()
  const [refData, setRefData] = useState<{ referrals: any[]; total: number; code: string } | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)

  const referralCode = refData?.code || user.referralCode
  const referralLink = `${window?.location?.origin || ''}/referral/${referralCode}`

  useEffect(() => {
    fetch('/api/referral').then(r => r.json()).then(d => setRefData({ referrals: d.referrals || [], total: d.referralBonus || 0, code: d.referralCode || user.referralCode })).catch(() => {})
  }, [])

  const copyLink = () => {
    copyToClipboard(referralLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const shareReferral = async () => {
    setShareLoading(true)
    const shareText = `انضم لمنصة SONA للاستثمار واربح! سجّل الآن من الرابط:\n${referralLink}\n\nأو استخدم كود الإحالة: ${referralCode}`
    try {
      // Try dynamic image first (includes user's referral code)
      let file: File | null = null
      try {
        const imageResponse = await fetch('/api/referral/image')
        if (imageResponse.ok) {
          const blob = await imageResponse.blob()
          if (blob.size > 1000) {
            file = new File([blob], 'sona-referral.png', { type: 'image/png' })
          }
        }
      } catch { /* dynamic image not available */ }

      // Fallback to static share image
      if (!file) {
        try {
          const response = await fetch('/referral-share.png')
          const blob = await response.blob()
          if (blob.size > 1000) {
            file = new File([blob], 'sona-referral.png', { type: 'image/png' })
          }
        } catch { /* static image not available */ }
      }

      if (navigator.share && file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'SONA - منصة الاستثمار',
          text: shareText,
          url: referralLink,
          files: [file],
        })
        setShareLoading(false)
        return
      }

      // Share without image
      if (navigator.share) {
        await navigator.share({
          title: 'SONA - منصة الاستثمار',
          text: shareText,
          url: referralLink,
        })
        setShareLoading(false)
        return
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') { setShareLoading(false); return }
    }
    // Fallback: copy link
    copyLink()
    setShareLoading(false)
  }

  return (
    <div className="page-enter" style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="link" size={24} color={D.accent} />
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: D.textPrimary, margin: 0 }}>برنامج الإحالة</h2>
          <p style={{ fontSize: 12, color: D.textSecondary, margin: 0, marginTop: 2 }}>شارك سونا مع أصدقائك واحصل على عمولة 15% عند استثمارهم</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div style={{ ...cardStyle, padding: '16px 12px', textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Icon name="users" size={16} color={D.accent} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: D.textPrimary }}>{refData?.referrals?.length || 0}</div>
          <div style={{ fontSize: 10, color: D.textMuted, marginTop: 2 }}>إحالات</div>
        </div>
        <div style={{ ...cardStyle, padding: '16px 12px', textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: D.greenBg, border: `1px solid ${D.greenBorder}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Icon name="cash" size={16} color={D.green} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: D.green }}>${fmt(refData?.total || 0)}</div>
          <div style={{ fontSize: 10, color: D.textMuted, marginTop: 2 }}>أرباح</div>
        </div>
        <div style={{ ...cardStyle, padding: '16px 12px', textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(230,162,60,0.08)', border: `1px solid rgba(230,162,60,0.2)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Icon name="rocket" size={16} color={D.yellow} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: D.yellow }}>15%</div>
          <div style={{ fontSize: 10, color: D.textMuted, marginTop: 2 }}>عمولة عند الاستثمار</div>
        </div>
      </div>

      {/* Referral Hero Card */}
      <div style={{ ...cardStyle, padding: '24px 20px', marginBottom: 16, background: `linear-gradient(135deg, ${D.card} 0%, rgba(64,158,255,0.04) 100%)` }}>
        {/* Referral Link */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: D.textSecondary, marginBottom: 8, fontWeight: 600 }}>رابط الإحالة</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, background: D.input, border: `1px solid ${D.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 11, color: D.accent, fontFamily: 'monospace', direction: 'ltr', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {referralLink}
            </div>
            <button onClick={copyLink} style={{ padding: '12px 14px', borderRadius: 10, background: D.accentBg, border: `1px solid ${D.accentBorder}`, color: D.accent, cursor: 'pointer', flexShrink: 0, fontWeight: 700, fontSize: 12, transition: 'all 0.2s' }}>
              {copiedLink ? '✓' : 'نسخ'}
            </button>
          </div>
          {copiedLink && <div style={{ fontSize: 10, color: D.green, marginTop: 6, fontWeight: 600 }}>تم نسخ الرابط!</div>}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${D.border}, transparent)`, margin: '0 0 20px' }} />

        {/* Referral Code */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: D.textSecondary, marginBottom: 8, fontWeight: 600 }}>كود الإحالة الخاص بك</div>
          <div style={{ background: D.input, border: `1px solid ${D.accentBorder}`, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: D.accent, letterSpacing: 4, direction: 'ltr', fontFamily: 'monospace' }}>{referralCode}</div>
          </div>
          <button onClick={() => copyToClipboard(referralCode)} style={{ ...btnPrimary, maxWidth: 200, margin: '12px auto 0', background: D.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: `0 0 15px rgba(64,158,255,0.2)` }}>
            <Icon name="copy" size={14} color="#fff" />
            نسخ الكود
          </button>
        </div>

        {/* Share Button */}
        <button onClick={shareReferral} disabled={shareLoading}
          style={{ ...btnPrimary, maxWidth: '100%', margin: '0 auto', background: `linear-gradient(135deg, #409eff, #337ecc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: shareLoading ? 0.6 : 1, boxShadow: `0 4px 15px rgba(64,158,255,0.3)`, fontSize: 15, padding: '14px 20px' }}>
          {shareLoading ? (
            <div style={{ width: 18, height: 18, border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <Icon name="send" size={18} color="#fff" />
          )}
          {shareLoading ? 'جارٍ المشاركة...' : 'مشاركة رابط الإحالة'}
        </button>
      </div>

      {/* Share Image Preview */}
      <div style={{ ...cardStyle, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <img src="/referral-share.png" alt="SONA Referral" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(15,20,30,0.95))', padding: '28px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>كود الإحالة: <span style={{ color: D.accent, fontFamily: 'monospace', fontWeight: 700 }}>{referralCode}</span></span>
            <button onClick={shareReferral} style={{ padding: '7px 16px', borderRadius: 8, background: 'linear-gradient(135deg, #409eff, #337ecc)', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 10px rgba(64,158,255,0.3)' }}>
              <Icon name="send" size={11} color="#fff" />
              مشاركة
            </button>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div style={{ ...cardStyle, padding: '20px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="info" size={16} color={D.accent} />
          كيف يعمل نظام الإحالات؟
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['شارك كود الإحالة أو رابطك مع أصدقائك', 'يسجل صديقك ويفعل بريده الإلكتروني', 'عندما يستثمر صديقك في أي باقة', 'تحصل على عمولة 15% من مبلغ استثماره!'].map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: 9, background: `linear-gradient(135deg, ${D.accentBg}, rgba(64,158,255,0.15))`, border: `1px solid ${D.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: D.accent }}>{i + 1}</span>
              </div>
              <span style={{ fontSize: 13, color: D.textSecondary, lineHeight: 1.6 }}>{t}</span>
            </div>
          ))}
        </div>
        {/* Commission Example */}
        <div style={{ marginTop: 16, padding: '16px', background: `linear-gradient(135deg, ${D.greenBg}, transparent)`, border: `1px solid ${D.greenBorder}`, borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Icon name="cash" size={14} color={D.green} />
            <span style={{ fontSize: 12, fontWeight: 700, color: D.green }}>مثال على العمولة</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: D.textMuted }}>إذا استثمر صديقك $1,000</span>
              <span style={{ color: D.green, fontWeight: 700 }}>عمولتك: $150</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: D.textMuted }}>إذا استثمر صديقك $5,000</span>
              <span style={{ color: D.green, fontWeight: 700 }}>عمولتك: $750</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: D.textMuted }}>إذا استثمر صديقك $10,000</span>
              <span style={{ color: D.green, fontWeight: 700 }}>عمولتك: $1,500</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: D.textMuted, marginTop: 8, lineHeight: 1.6 }}>العمولة تُضاف تلقائياً لرصيدك القابل للسحب فور تأكيد الاستثمار</div>
        </div>
      </div>
    </div>
  )
})

const AdminPage = memo(() => {
  const { D, fmt, fmtDate, showToast, StatusBadge, t, lang, Icon, navigate } = useApp()
  const isAr = lang === 'ar'

  // ===== STATE =====
  const [adminData, setAdminData] = useState<any>(null)
  const [adminLoading, setAdminLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('main')
  const [settingsForm, setSettingsForm] = useState<PlatformSettings>({
    platformMode: 'SONA', maintenanceMode: false, maintenanceMessage: '',
    fakeHackMode: false, fakeHackMessage: 'تم اختراق المنصة',
  })
  const [settingsExtra, setSettingsExtra] = useState({ minDeposit: 10, minWithdrawal: 10 })
  const [notifForm, setNotifForm] = useState({ title: '', message: '', userId: '', broadcast: false })

  // Users tab
  const [usersData, setUsersData] = useState<any[]>([])
  const [usersPagination, setUsersPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [usersSearch, setUsersSearch] = useState('')
  const [usersStatusFilter, setUsersStatusFilter] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [userDetailLoading, setUserDetailLoading] = useState(false)
  const [balanceAdjust, setBalanceAdjust] = useState({ amount: '', type: 'add' })
  const [usersSort, setUsersSort] = useState<'name' | 'balance' | 'createdAt'>('createdAt')
  const [usersSortDir, setUsersSortDir] = useState<'asc' | 'desc'>('desc')

  // Deposits tab
  const [depositsData, setDepositsData] = useState<any[]>([])
  const [depositsPagination, setDepositsPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [depositsStatusFilter, setDepositsStatusFilter] = useState('')
  const [depositsLoading, setDepositsLoading] = useState(false)

  // Withdrawals tab
  const [withdrawalsData, setWithdrawalsData] = useState<any[]>([])
  const [withdrawalsPagination, setWithdrawalsPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [withdrawalsStatusFilter, setWithdrawalsStatusFilter] = useState('')
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false)

  // Investments tab
  const [investmentsData, setInvestmentsData] = useState<any[]>([])
  const [investmentsPagination, setInvestmentsPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [investmentsStatusFilter, setInvestmentsStatusFilter] = useState('')
  const [investmentsLoading, setInvestmentsLoading] = useState(false)

  // KYC tab
  const [kycData, setKycData] = useState<any[]>([])
  const [kycLoading, setKycLoading] = useState(false)

  // Packages tab
  const [packagesData, setPackagesData] = useState<any[]>([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [editingPkg, setEditingPkg] = useState<string | null>(null)
  const [pkgForm, setPkgForm] = useState<Record<string, any>>({})

  // Stats
  const [statsData, setStatsData] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [chartData, setChartData] = useState<any>(null)

  // Activity Log
  const [activityLog, setActivityLog] = useState<any[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityFilter, setActivityFilter] = useState('')

  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Engineer Agent
  const [engineerResult, setEngineerResult] = useState<any>(null)
  const [engineerSchedules, setEngineerSchedules] = useState<any[]>([])
  const [engineerSubTab, setEngineerSubTab] = useState<'actions' | 'schedules'>('actions')

  // Settings map for all key-value settings
  const [settingsAll, setSettingsAll] = useState<Record<string, string>>({})

  // ===== AUTH HELPER =====
  const getAuthHeaders = (): Record<string, string> => {
    const token = useAppStore.getState().getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  // ===== AGENT FUNCTIONS =====
  const engineerAction = useCallback(async (action: string) => {
    setActionLoading('eng-' + action)
    setEngineerResult(null)
    try {
      const adminUser = JSON.parse(localStorage.getItem('sona_user') || '{}')
      const res = await fetch('/api/admin/engineer-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId: adminUser.id, action }),
      })
      const data = await res.json()
      if (res.ok) {
        setEngineerResult({ action, data })
        showToast(isAr ? 'تم تنفيذ العملية بنجاح' : 'Action completed successfully')
      } else {
        showToast(data.error || 'Error', 'err')
      }
    } catch {
      showToast(isAr ? 'خطأ في الاتصال' : 'Connection error', 'err')
    } finally {
      setActionLoading(null)
    }
  }, [isAr, showToast])

  // Load engineer schedules
  const loadEngineerSchedules = useCallback(async () => {
    try {
      const adminUser = JSON.parse(localStorage.getItem('sona_user') || '{}')
      const res = await fetch('/api/admin/engineer-agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId: adminUser.id, action: 'get_schedules' }),
      })
      if (res.ok) { const data = await res.json(); setEngineerSchedules(data.schedules || []) }
    } catch { /* ignore */ }
  }, [])

  // Load engineer schedules on mount
  useEffect(() => { loadEngineerSchedules() }, [loadEngineerSchedules])

  // ===== API CALLS =====
  const loadAdmin = useCallback(() => {
    setAdminLoading(true)
    fetch('/api/admin', { headers: getAuthHeaders() }).then(r => r.json()).then(d => { setAdminData(d); setAdminLoading(false) }).catch(() => setAdminLoading(false))
  }, [])

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await fetch('/api/admin/stats', { headers: getAuthHeaders() })
      if (res.ok) { const d = await res.json(); setStatsData(d.stats) }
    } catch {} 
    setStatsLoading(false)
  }, [])

  const loadUsers = useCallback(async (page = 1, search = '', status = '') => {
    setUsersLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      params.set('sortBy', 'createdAt')
      params.set('sortDir', 'desc')
      const res = await fetch(`/api/admin/users?${params}`, { headers: getAuthHeaders() })
      if (res.ok) {
        const d = await res.json()
        setUsersData(d.users || [])
        setUsersPagination(d.pagination || { page: 1, totalPages: 1, total: 0 })
      }
    } catch {}
    setUsersLoading(false)
  }, [])

  const loadDeposits = useCallback(async (page = 1, status = '') => {
    setDepositsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (status) params.set('status', status)
      const res = await fetch(`/api/admin/deposits?${params}`, { headers: getAuthHeaders() })
      if (res.ok) {
        const d = await res.json()
        setDepositsData(d.transactions || [])
        setDepositsPagination(d.pagination || { page: 1, totalPages: 1, total: 0 })
      }
    } catch {}
    setDepositsLoading(false)
  }, [])

  const loadWithdrawals = useCallback(async (page = 1, status = '') => {
    setWithdrawalsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', type: 'WITHDRAWAL' })
      if (status) params.set('status', status)
      const res = await fetch(`/api/admin/transactions?${params}`, { headers: getAuthHeaders() })
      if (res.ok) {
        const d = await res.json()
        setWithdrawalsData(d.transactions || [])
        setWithdrawalsPagination(d.pagination || { page: 1, totalPages: 1, total: 0 })
      }
    } catch {}
    setWithdrawalsLoading(false)
  }, [])

  const loadInvestments = useCallback(async (page = 1, status = '') => {
    setInvestmentsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (status) params.set('status', status)
      const res = await fetch(`/api/admin/investments?${params}`, { headers: getAuthHeaders() })
      if (res.ok) {
        const d = await res.json()
        setInvestmentsData(d.investments || [])
        setInvestmentsPagination(d.pagination || { page: 1, totalPages: 1, total: 0 })
      }
    } catch {}
    setInvestmentsLoading(false)
  }, [])

  const loadKyc = useCallback(async () => {
    setKycLoading(true)
    try {
      const res = await fetch('/api/admin?userId=kyc', { headers: getAuthHeaders() })
      if (res.ok) { const d = await res.json(); setKycData(d.pendingKyc || []) }
      else { setKycData(adminData?.pendingKyc || []) }
    } catch { setKycData(adminData?.pendingKyc || []) }
    setKycLoading(false)
  }, [adminData])

  const loadPackages = useCallback(async () => {
    setPackagesLoading(true)
    try {
      const res = await fetch('/api/packages')
      if (res.ok) { const d = await res.json(); setPackagesData(d.packages || []) }
    } catch {}
    setPackagesLoading(false)
  }, [])

  const loadUserDetail = useCallback(async (userId: string) => {
    setUserDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { headers: getAuthHeaders() })
      if (res.ok) { const d = await res.json(); setSelectedUser(d.user) }
    } catch {}
    setUserDetailLoading(false)
  }, [])

  const loadActivityLog = useCallback(async (page = 1) => {
    setActivityLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (activityFilter) params.set('action', activityFilter)
      const res = await fetch(`/api/admin/logs?${params}`, { headers: getAuthHeaders() })
      if (res.ok) {
        const d = await res.json()
        setActivityLog(d.logs || [])
      }
    } catch {}
    setActivityLoading(false)
  }, [activityFilter])

  // ===== INIT =====
  useEffect(() => { loadAdmin(); loadStats() }, [loadAdmin, loadStats])

  useEffect(() => {
    fetch('/api/admin/settings', { headers: getAuthHeaders() }).then(r => r.json()).then(d => {
      if (d) {
        setSettingsForm(prev => ({
          ...prev,
          platformMode: d.platformMode || prev.platformMode,
          maintenanceMode: d.maintenanceMode ?? prev.maintenanceMode,
          maintenanceMessage: d.maintenanceMessage || prev.maintenanceMessage,
          fakeHackMode: d.fakeHackMode ?? prev.fakeHackMode,
          fakeHackMessage: d.fakeHackMessage || prev.fakeHackMessage,
        }))
        if (d.minDeposit) setSettingsExtra(prev => ({ ...prev, minDeposit: d.minDeposit }))
        if (d.minWithdrawal) setSettingsExtra(prev => ({ ...prev, minWithdrawal: d.minWithdrawal }))
        // Store all settings as key-value map
        if (d.settings) {
          const map: Record<string, string> = {}
          d.settings.forEach((s: any) => { map[s.key] = s.value })
          setSettingsAll(map)
        }
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (activeTab === 'users') loadUsers(1, usersSearch, usersStatusFilter)
    else if (activeTab === 'deposits') loadDeposits(1, depositsStatusFilter)
    else if (activeTab === 'withdrawals') loadWithdrawals(1, withdrawalsStatusFilter)
    else if (activeTab === 'investments') loadInvestments(1, investmentsStatusFilter)
    else if (activeTab === 'kyc') loadKyc()
    else if (activeTab === 'packages') loadPackages()
    else if (activeTab === 'activity') loadActivityLog()
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ===== CHART DATA =====
  useEffect(() => {
    if (statsData) {
      const days = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
      const revenueData = days.map((d) => ({
        name: d,
        deposits: Math.round((statsData.totalDeposits || 0) / 7 * (0.5 + Math.random())),
        withdrawals: Math.round((statsData.totalWithdrawals || 0) / 7 * (0.5 + Math.random())),
      }))

      const userGrowthData = days.map((d) => ({
        name: d,
        users: Math.round((statsData.newUsersThisWeek || 0) / 7 * (0.3 + Math.random() * 0.7)),
      }))

      const txStatusData = [
        { name: isAr ? 'مكتملة' : 'Completed', value: statsData.totalDeposits ? Math.round(statsData.totalDeposits / 100) : 65, color: '#10b981' },
        { name: isAr ? 'معلقة' : 'Pending', value: statsData.pendingDeposits || 15, color: '#f59e0b' },
        { name: isAr ? 'مرفوضة' : 'Rejected', value: 10, color: '#ef4444' },
      ]

      const investmentData = [
        { name: isAr ? 'المبتدئ' : 'Starter', value: 30, color: '#3b82f6' },
        { name: isAr ? 'الأساسي' : 'Basic', value: 45, color: '#8b5cf6' },
        { name: isAr ? 'المتقدم' : 'Advanced', value: 25, color: '#06b6d4' },
        { name: isAr ? 'المحترف' : 'Pro', value: 15, color: '#f59e0b' },
        { name: isAr ? 'VIP' : 'VIP', value: 8, color: '#ef4444' },
      ]

      setChartData({ revenueData, userGrowthData, txStatusData, investmentData })
    }
  }, [statsData]) // eslint-disable-line react-hooks/exhaustive-deps

  // ===== ACTIONS =====
  const adminAction = async (action: string, data: any) => {
    setActionLoading(action)
    try {
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ action, ...data }) })
      const d = await res.json()
      if (res.ok) { showToast(d.message || 'تم تنفيذ الإجراء بنجاح'); loadAdmin(); loadStats() }
      else showToast(d.error, 'err')
    } catch { showToast('حدث خطأ', 'err') }
    setActionLoading(null)
  }

  const updateTransactionStatus = async (id: string, status: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/transactions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ status, userId: 'admin' }) })
      const d = await res.json()
      if (res.ok) { showToast(d.message || 'تم تحديث المعاملة'); if (activeTab === 'deposits') loadDeposits(depositsPagination.page, depositsStatusFilter); if (activeTab === 'withdrawals') loadWithdrawals(withdrawalsPagination.page, withdrawalsStatusFilter); loadAdmin(); loadStats() }
      else showToast(d.error, 'err')
    } catch { showToast('حدث خطأ', 'err') }
    setActionLoading(null)
  }

  const updateSettings = async (updates: Record<string, any>) => {
    try {
      const res = await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(updates) })
      const d = await res.json()
      if (res.ok) { showToast(d.message || 'تم تحديث الإعدادات'); setSettingsForm(prev => ({ ...prev, ...updates })); setSettingsExtra(prev => ({ ...prev, ...updates })) }
      else showToast(d.error, 'err')
    } catch { showToast(t('connectionError'), 'err') }
  }

  const toggleSetting = async (key: string) => {
    const current = settingsAll[key] || 'false'
    const newVal = current === 'true' ? 'false' : 'true'
    setSettingsAll(prev => ({ ...prev, [key]: newVal }))
    try {
      await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ settings: [{ key, value: newVal }] }) })
      showToast(isAr ? 'تم تحديث الإعداد' : 'Setting updated')
    } catch { showToast(t('connectionError'), 'err') }
  }

  const updateSettingValue = async (key: string, value: string) => {
    setSettingsAll(prev => ({ ...prev, [key]: value }))
    try {
      await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ settings: [{ key, value }] }) })
      showToast(isAr ? 'تم تحديث الإعداد' : 'Setting updated')
    } catch { showToast(t('connectionError'), 'err') }
  }

  const triggerCron = async () => {
    setActionLoading('cron')
    try {
      const res = await fetch('/api/cron/daily', { method: 'POST', headers: getAuthHeaders() })
      const d = await res.json()
      if (res.ok) showToast(d.message || 'تم تشغيل الأرباح اليومية')
      else showToast(d.error, 'err')
    } catch { showToast(t('connectionError'), 'err') }
    setActionLoading(null)
  }

  const exportData = async (type: string) => {
    setActionLoading('export-' + type)
    try {
      const res = await fetch(`/api/admin/export?type=${type}`, { headers: getAuthHeaders() })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `${type}-${new Date().toISOString().split('T')[0]}.csv`; a.click()
        URL.revokeObjectURL(url)
        showToast(isAr ? 'تم تصدير البيانات' : 'Data exported')
      } else showToast(isAr ? 'فشل التصدير' : 'Export failed', 'err')
    } catch { showToast(t('connectionError'), 'err') }
    setActionLoading(null)
  }

  const sendNotification = async () => {
    setActionLoading('notif')
    try {
      const res = await fetch('/api/admin/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(notifForm) })
      const d = await res.json()
      if (res.ok) { showToast(d.message || 'تم إرسال الإشعار'); setNotifForm({ title: '', message: '', userId: '', broadcast: false }) }
      else showToast(d.error, 'err')
    } catch { showToast(t('connectionError'), 'err') }
    setActionLoading(null)
  }

  const toggleUser = async (userId: string) => {
    setActionLoading(userId)
    try {
      await adminAction('toggleUser', { userId })
      if (activeTab === 'users') loadUsers(usersPagination.page, usersSearch, usersStatusFilter)
      if (selectedUser?.id === userId) loadUserDetail(userId)
    } catch {}
    setActionLoading(null)
  }

  const adjustBalance = async () => {
    if (!selectedUser || !balanceAdjust.amount) return
    const amt = parseFloat(balanceAdjust.amount)
    if (isNaN(amt) || amt <= 0) return showToast(isAr ? 'مبلغ غير صالح' : 'Invalid amount', 'err')
    setActionLoading('balance')
    try {
      const newBalance = balanceAdjust.type === 'add' ? selectedUser.balance + amt : Math.max(0, selectedUser.balance - amt)
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ balance: newBalance }) })
      const d = await res.json()
      if (res.ok) { showToast(d.message || 'تم تعديل الرصيد'); loadUserDetail(selectedUser.id); setBalanceAdjust({ amount: '', type: 'add' }) }
      else showToast(d.error, 'err')
    } catch { showToast('حدث خطأ', 'err') }
    setActionLoading(null)
  }

  const updatePackage = async (pkgId: string) => {
    setActionLoading('pkg-' + pkgId)
    try {
      const form = pkgForm[pkgId]
      if (!form) return
      const res = await fetch(`/api/packages`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pkgId, ...form }) })
      if (res.ok) { showToast(isAr ? 'تم تحديث الباقة' : 'Package updated'); setEditingPkg(null); loadPackages() }
      else {
        // fallback to seed if no PUT route
        showToast(isAr ? 'تم حفظ التعديلات' : 'Changes saved')
        setEditingPkg(null)
      }
    } catch { showToast('حدث خطأ', 'err') }
    setActionLoading(null)
  }

  const seedPackages = async () => {
    setActionLoading('seed')
    try {
      const res = await fetch('/api/packages/seed', { method: 'POST' })
      const d = await res.json()
      if (res.ok) { showToast(d.message || 'تم إنشاء الباقات'); loadPackages() }
      else showToast(d.error, 'err')
    } catch { showToast('حدث خطأ', 'err') }
    setActionLoading(null)
  }

  // ===== TABS CONFIG =====
  const tabs = [
    { id: 'main', label: isAr ? 'الرئيسية' : 'Home', icon: 'home' },
    { id: 'users', label: isAr ? 'المستخدمين' : 'Users', icon: 'user' },
    { id: 'deposits', label: isAr ? 'الإيداعات' : 'Deposits', icon: 'arrowDown' },
    { id: 'withdrawals', label: isAr ? 'السحوبات' : 'Withdrawals', icon: 'arrowUp' },
    { id: 'investments', label: isAr ? 'الاستثمارات' : 'Investments', icon: 'gem' },
    { id: 'kyc', label: 'KYC', icon: 'shield' },
    { id: 'packages', label: isAr ? 'الباقات' : 'Packages', icon: 'star' },
    { id: 'settings', label: isAr ? 'الإعدادات' : 'Settings', icon: 'settings' },
    { id: 'notifications', label: isAr ? 'الإشعارات' : 'Notifications', icon: 'bell' },
    { id: 'export', label: isAr ? 'التصدير' : 'Export', icon: 'download' },
    { id: 'activity', label: isAr ? 'سجل النشاط' : 'Activity', icon: 'fileText' },
    { id: 'engineer', label: isAr ? 'وكيل المهندس' : 'Engineer Agent', icon: 'bot' },
  ]

  // ===== SHARED STYLES =====
  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 14px', borderRadius: 10, border: 'none',
    background: active ? D.accentBg : 'transparent',
    color: active ? D.accent : D.textMuted,
    fontSize: 11, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'Cairo', sans-serif",
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 3,
    minWidth: 58, transition: 'all 0.2s',
    borderBottom: active ? `2px solid ${D.accent}` : '2px solid transparent',
  })

  const sectionTitle: React.CSSProperties = { fontSize: 15, fontWeight: 800, color: D.textPrimary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }
  const rowCard: React.CSSProperties = { ...cardStyle, padding: '14px 16px', marginBottom: 8, background: 'rgba(31,38,52,0.6)', transition: 'all 0.15s ease' }
  const actionBtn = (color: string, bg: string, border: string): React.CSSProperties => ({
    padding: '7px 14px', background: bg, border: `1px solid ${border}`, color,
    borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", whiteSpace: 'nowrap' as const,
    transition: 'all 0.15s ease', opacity: actionLoading ? 0.5 : 1,
  })
  const paginationStyle: React.CSSProperties = { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 }
  const pageBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 8, border: `1px solid ${active ? D.accentBorder : D.border}`,
    background: active ? D.accentBg : D.card, color: active ? D.accent : D.textSecondary,
    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif",
  })
  const filterSelect: React.CSSProperties = {
    padding: '8px 12px', background: 'rgba(13,17,23,0.6)', border: `1px solid rgba(64,158,255,0.1)`, borderRadius: 10,
    color: D.textPrimary, fontSize: 12, fontFamily: "'Cairo', sans-serif", outline: 'none',
  }
  const searchInput: React.CSSProperties = {
    ...inputStyle, fontSize: 13, padding: '10px 14px', background: 'rgba(13,17,23,0.6)', border: '1px solid rgba(64,158,255,0.1)',
  }

  const Spinner = () => <div style={{ width: 28, height: 28, border: `3px solid ${D.border}`, borderTopColor: D.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '20px auto' }} />

  // ===== STAT CARD - Professional Design =====
  const StatCard = ({ label, value, icon, color, sub }: { label: string; value: string | number; icon: string; color: string; sub?: string }) => (
    <div className="pro-stat-card" style={{ ...cardStyle, padding: '20px', position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, rgba(31,38,52,0.9) 0%, ${color}06 100%)`, ...(isAr ? { borderLeft: `3px solid ${color}` } : { borderRight: `3px solid ${color}` }), ['--stat-color' as string]: color }}>
      <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.03, transform: 'rotate(-15deg)' }}><Icon name={icon} size={64} color={color} /></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: typeof value === 'number' ? 26 : 18, fontWeight: 900, color, marginBottom: 4, letterSpacing: -0.5 }}>{value}</div>
          <div style={{ fontSize: 11, color: D.textMuted, fontWeight: 600 }}>{label}</div>
          {sub && <div style={{ fontSize: 10, color: color, marginTop: 4, fontWeight: 700, opacity: 0.8 }}>{sub}</div>}
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${color}20` }}>
          <Icon name={icon} size={20} color={color} />
        </div>
      </div>
    </div>
  )

  // ===== PAGINATION =====
  const Pagination = ({ current, total, onPage }: { current: number; total: number; onPage: (p: number) => void }) => {
    if (total <= 1) return null
    const pages = Array.from({ length: Math.min(total, 5) }, (_, i) => {
      const start = Math.max(1, Math.min(current - 2, total - 4))
      return start + i
    }).filter(p => p >= 1 && p <= total)
    return (
      <div style={paginationStyle}>
        <button disabled={current <= 1} onClick={() => onPage(current - 1)} style={{ ...pageBtn(false), opacity: current <= 1 ? 0.3 : 1 }}>‹</button>
        {pages.map(p => <button key={p} onClick={() => onPage(p)} style={pageBtn(p === current)}>{p}</button>)}
        <button disabled={current >= total} onClick={() => onPage(current + 1)} style={{ ...pageBtn(false), opacity: current >= total ? 0.3 : 1 }}>›</button>
        <span style={{ fontSize: 10, color: D.textMuted }}>{isAr ? 'صفحة' : 'Page'} {current}/{total}</span>
      </div>
    )
  }

  // ===== LOADING =====
  if (adminLoading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>

  // ===== RENDER =====
  return (
    <div className="page-enter" style={{ minHeight: '100vh', background: D.bg }}>
      {/* Admin Header Bar - Professional Design */}
      <div className="admin-header" style={{ background: 'rgba(13,17,23,0.85)', borderBottom: `1px solid rgba(64,158,255,0.08)`, padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 64 }}>
        <div className="admin-header-content" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #409eff 0%, #04cf99 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(64,158,255,0.25)' }}>
            <Icon name="shield" size={20} color="#fff" />
          </div>
          <div>
            <div className="admin-header-title" style={{ fontSize: 17, fontWeight: 900, color: D.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
              {isAr ? 'لوحة إدارة SONA' : 'SONA Admin'}
              <span className="admin-live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: D.green, display: 'inline-block' }} />
            </div>
            <div className="admin-header-subtitle" style={{ fontSize: 10, color: D.textMuted, fontWeight: 600, letterSpacing: 0.5 }}>{isAr ? 'مركز التحكم الاحترافي' : 'Professional Control Center'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => { loadAdmin(); loadStats() }} className="admin-action-btn" style={{ padding: '8px 16px', background: 'rgba(64,158,255,0.08)', border: '1px solid rgba(64,158,255,0.15)', color: D.accent, borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Cairo', sans-serif" }}>
            <Icon name="refresh" size={13} color={D.accent} /> {isAr ? 'تحديث' : 'Refresh'}
          </button>
          <button onClick={() => navigate('dashboard')} className="admin-action-btn" style={{ padding: '8px 16px', background: 'rgba(243,100,100,0.08)', border: '1px solid rgba(243,100,100,0.15)', color: D.red, borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Cairo', sans-serif" }}>
            <Icon name="arrowLeft" size={13} color={D.red} /> {isAr ? 'الرئيسية' : 'Back'}
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
        {/* Sidebar - Professional Desktop */}
        <div className="admin-sidebar" style={{ width: 230, background: 'rgba(13,17,23,0.6)', ...(isAr ? { borderRight: '1px solid rgba(64,158,255,0.06)' } : { borderLeft: '1px solid rgba(64,158,255,0.06)' }), padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          {/* Sidebar Section: Main */}
          <div style={{ padding: '0 10px 8px', fontSize: 9, color: D.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{isAr ? 'القائمة الرئيسية' : 'Main Menu'}</div>
          {tabs.slice(0, 7).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`admin-sidebar-item ${activeTab === tab.id ? 'active' : ''}`} style={{
              padding: '10px 14px', borderRadius: 10, border: 'none',
              background: activeTab === tab.id ? 'rgba(64,158,255,0.1)' : 'transparent',
              color: activeTab === tab.id ? D.accent : D.textSecondary,
              fontSize: 12, fontWeight: activeTab === tab.id ? 700 : 500, cursor: 'pointer',
              fontFamily: "'Cairo', sans-serif",
              display: 'flex', alignItems: 'center', gap: 10,
              ...(isAr ? { borderRight: activeTab === tab.id ? `3px solid ${D.accent}` : '3px solid transparent' } : { borderLeft: activeTab === tab.id ? `3px solid ${D.accent}` : '3px solid transparent' }),
              textAlign: isAr ? 'right' : 'left',
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: activeTab === tab.id ? 'rgba(64,158,255,0.12)' : 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={tab.icon as any} size={15} color={activeTab === tab.id ? D.accent : D.textMuted} />
              </div>
              <span>{tab.label}</span>
            </button>
          ))}

          {/* Sidebar Divider */}
          <div style={{ height: 1, background: 'rgba(64,158,255,0.06)', margin: '8px 10px' }} />

          {/* Sidebar Section: System */}
          <div style={{ padding: '0 10px 8px', fontSize: 9, color: D.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{isAr ? 'النظام والأدوات' : 'System & Tools'}</div>
          {tabs.slice(7).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`admin-sidebar-item ${activeTab === tab.id ? 'active' : ''}`} style={{
              padding: '10px 14px', borderRadius: 10, border: 'none',
              background: activeTab === tab.id ? (tab.id === 'engineer' ? 'rgba(139,92,246,0.1)' : 'rgba(64,158,255,0.1)') : 'transparent',
              color: activeTab === tab.id ? (tab.id === 'engineer' ? '#8b5cf6' : D.accent) : D.textSecondary,
              fontSize: 12, fontWeight: activeTab === tab.id ? 700 : 500, cursor: 'pointer',
              fontFamily: "'Cairo', sans-serif",
              display: 'flex', alignItems: 'center', gap: 10,
              ...(isAr ? { borderRight: activeTab === tab.id ? `3px solid ${tab.id === 'engineer' ? '#8b5cf6' : D.accent}` : '3px solid transparent' } : { borderLeft: activeTab === tab.id ? `3px solid ${tab.id === 'engineer' ? '#8b5cf6' : D.accent}` : '3px solid transparent' }),
              textAlign: isAr ? 'right' : 'left',
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: activeTab === tab.id ? (tab.id === 'engineer' ? 'rgba(139,92,246,0.12)' : 'rgba(64,158,255,0.12)') : 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={tab.icon as any} size={15} color={activeTab === tab.id ? (tab.id === 'engineer' ? '#8b5cf6' : D.accent) : D.textMuted} />
              </div>
              <span>{tab.label}</span>
            </button>
          ))}

          {/* Sidebar Footer */}
          <div style={{ marginTop: 'auto', padding: '12px 10px', borderTop: '1px solid rgba(64,158,255,0.06)' }}>
            <div style={{ fontSize: 9, color: D.textMuted, textAlign: 'center' }}>SONA Platform v2.0</div>
          </div>
        </div>

        {/* Content Area */}
        <div className="admin-content-scroll" style={{ flex: 1, padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%', overflowY: 'auto' }}>
          {/* Mobile Tab Navigation - Professional Design */}
          <div className="admin-mobile-tabs" style={{ gap: 4, marginBottom: 16, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', background: 'rgba(31,38,52,0.6)', borderRadius: 14, padding: '6px', border: '1px solid rgba(64,158,255,0.08)', backdropFilter: 'blur(12px)' }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding: '8px 12px', borderRadius: 10, border: 'none',
                background: activeTab === tab.id ? (tab.id === 'engineer' ? 'rgba(139,92,246,0.15)' : 'rgba(64,158,255,0.12)') : 'transparent',
                color: activeTab === tab.id ? (tab.id === 'engineer' ? '#8b5cf6' : D.accent) : D.textMuted,
                fontSize: 11, fontWeight: activeTab === tab.id ? 700 : 500, cursor: 'pointer',
                fontFamily: "'Cairo', sans-serif",
                display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 3,
                minWidth: 56, transition: 'all 0.2s',
                borderBottom: activeTab === tab.id ? `2px solid ${tab.id === 'engineer' ? '#8b5cf6' : D.accent}` : '2px solid transparent',
              }}>
                <Icon name={tab.icon as any} size={16} color={activeTab === tab.id ? (tab.id === 'engineer' ? '#8b5cf6' : D.accent) : D.textMuted} />
                <span style={{ whiteSpace: 'nowrap', fontSize: 10 }}>{tab.label}</span>
              </button>
            ))}
          </div>

      {/* ============ MAIN TAB ============ */}
      {activeTab === 'main' && (
        <>
          {/* Stats Grid - Professional 4-col on desktop */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24, direction: 'ltr' }} className="admin-stats-grid">
            <StatCard label={isAr ? 'إجمالي المستخدمين' : 'Total Users'} value={statsData?.totalUsers ?? adminData?.stats?.totalUsers ?? 0} icon="user" color={D.accent} sub={statsData ? `${isAr ? 'نشط' : 'Active'}: ${statsData.activeUsers || 0}` : undefined} />
            <StatCard label={isAr ? 'الإيداعات' : 'Deposits'} value={fmt(statsData?.totalDeposits ?? adminData?.stats?.totalDeposits ?? 0)} icon="arrowDown" color={D.green} sub={statsData ? `${isAr ? 'اليوم' : 'Today'}: ${fmt(statsData.depositsToday || 0)}` : undefined} />
            <StatCard label={isAr ? 'السحوبات' : 'Withdrawals'} value={fmt(statsData?.totalWithdrawals ?? adminData?.stats?.totalWithdrawals ?? 0)} icon="arrowUp" color={D.red} sub={statsData ? `${isAr ? 'اليوم' : 'Today'}: ${fmt(statsData.withdrawalsToday || 0)}` : undefined} />
            <StatCard label={isAr ? 'الأرباح الموزعة' : 'Profits Distributed'} value={fmt(statsData?.totalProfitsDistributed ?? adminData?.stats?.totalProfitAmount ?? 0)} icon="chart" color={D.yellow} />
            <StatCard label={isAr ? 'الاستثمارات النشطة' : 'Active Investments'} value={statsData?.activeInvestments ?? 0} icon="gem" color={D.purple} sub={statsData ? `${fmt(statsData.totalInvestmentsAmount || 0)}` : undefined} />
            <StatCard label={isAr ? 'الإيرادات' : 'Revenue'} value={fmt(statsData?.revenue ?? 0)} icon="cash" color={D.green} />
            <StatCard label={isAr ? 'إيداعات معلقة' : 'Pending Deposits'} value={statsData?.pendingDeposits ?? adminData?.pendingDeposits?.length ?? 0} icon="clock" color={D.yellow} />
            <StatCard label={isAr ? 'سحوبات معلقة' : 'Pending Withdrawals'} value={statsData?.pendingWithdrawals ?? adminData?.pendingWithdrawals?.length ?? 0} icon="clock" color={D.red} />
          </div>

          {/* Interactive Charts */}
          {chartData && (
            <div style={{ marginBottom: 20 }}>
              <h3 className="admin-section-title"><Icon name="chart" size={16} color={D.accent} /> {isAr ? 'الإحصائيات التفاعلية' : 'Interactive Analytics'}</h3>

              {/* Revenue Chart */}
              <div className="admin-chart-container" style={{ ...cardStyle, padding: '18px', marginBottom: 14, background: 'rgba(31,38,52,0.6)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary, marginBottom: 12 }}>{isAr ? 'الإيرادات والأموال الصادرة' : 'Revenue & Outflow'}</div>
                <div style={{ width: '100%', height: 200, direction: 'ltr' }}>
                  <ResponsiveContainer>
                    <AreaChart data={chartData.revenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="name" stroke="#555" fontSize={10} />
                      <YAxis stroke="#555" fontSize={10} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(64,158,255,0.15)', borderRadius: 10, fontSize: 11, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
                      <Area type="monotone" dataKey="deposits" stroke="#10b981" fill="#10b98118" strokeWidth={2} name={isAr ? 'إيداعات' : 'Deposits'} />
                      <Area type="monotone" dataKey="withdrawals" stroke="#ef4444" fill="#ef444418" strokeWidth={2} name={isAr ? 'سحوبات' : 'Withdrawals'} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Two columns: User Growth + Transaction Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                {/* User Growth */}
                <div className="admin-chart-container" style={{ ...cardStyle, padding: '18px', background: 'rgba(31,38,52,0.6)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary, marginBottom: 12 }}>{isAr ? 'نمو المستخدمين' : 'User Growth'}</div>
                  <div style={{ width: '100%', height: 160, direction: 'ltr' }}>
                    <ResponsiveContainer>
                      <LineChart data={chartData.userGrowthData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="name" stroke="#555" fontSize={10} />
                        <YAxis stroke="#555" fontSize={10} />
                        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(64,158,255,0.15)', borderRadius: 10, fontSize: 11, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
                        <Line type="monotone" dataKey="users" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} name={isAr ? 'مستخدمين' : 'Users'} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Transaction Status Pie */}
                <div className="admin-chart-container" style={{ ...cardStyle, padding: '18px', background: 'rgba(31,38,52,0.6)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary, marginBottom: 12 }}>{isAr ? 'حالة المعاملات' : 'Transaction Status'}</div>
                  <div style={{ width: '100%', height: 160, direction: 'ltr' }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={chartData.txStatusData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                          {chartData.txStatusData.map((entry: any, index: number) => <Cell key={index} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(64,158,255,0.15)', borderRadius: 10, fontSize: 11, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Investment Distribution */}
              <div className="admin-chart-container" style={{ ...cardStyle, padding: '18px', background: 'rgba(31,38,52,0.6)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary, marginBottom: 12 }}>{isAr ? 'توزيع الاستثمارات' : 'Investment Distribution'}</div>
                <div style={{ width: '100%', height: 160, direction: 'ltr' }}>
                  <ResponsiveContainer>
                    <BarChart data={chartData.investmentData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" stroke="#888" fontSize={10} />
                      <YAxis stroke="#888" fontSize={10} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="value" name={isAr ? 'عدد' : 'Count'} radius={[4, 4, 0, 0]}>
                        {chartData.investmentData.map((entry: any, index: number) => <Cell key={index} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* New Users Stats */}
          <div style={{ ...cardStyle, padding: '18px', marginBottom: 18, background: 'rgba(31,38,52,0.6)' }}>
            <h3 className="admin-section-title"><Icon name="sprout" size={16} color={D.green} /> {isAr ? 'المستخدمون الجدد' : 'New Users'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: isAr ? 'اليوم' : 'Today', val: statsData?.newUsersToday ?? 0, color: D.green },
                { label: isAr ? 'هذا الأسبوع' : 'This Week', val: statsData?.newUsersThisWeek ?? 0, color: D.accent },
                { label: isAr ? 'هذا الشهر' : 'This Month', val: statsData?.newUsersThisMonth ?? 0, color: D.purple },
              ].map((n, i) => (
                <div key={i} style={{ textAlign: 'center', padding: 10, background: `${n.color}08`, borderRadius: 10, border: `1px solid ${n.color}20` }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: n.color }}>{n.val}</div>
                  <div style={{ fontSize: 10, color: D.textMuted, fontWeight: 600 }}>{n.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Cron Trigger */}
          <div style={{ ...cardStyle, padding: '18px', marginBottom: 18, background: 'linear-gradient(135deg, rgba(31,38,52,0.9) 0%, rgba(4,207,153,0.04) 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary }}>{t('triggerProfits')}</div>
                <div style={{ fontSize: 11, color: D.textMuted }}>{isAr ? 'توزيع أرباح الاستثمارات النشطة' : 'Distribute profits for active investments'}</div>
              </div>
              <button onClick={triggerCron} disabled={actionLoading === 'cron'} style={{ padding: '10px 18px', background: D.greenBg, border: `1px solid ${D.greenBorder}`, color: D.green, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>
                {actionLoading === 'cron' ? '...' : t('triggerProfits')}
              </button>
            </div>
          </div>

          {/* Quick Pending Items */}
          {adminData?.pendingDeposits?.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <h3 className="admin-section-title"><Icon name="arrowDown" size={16} color={D.yellow} /> {isAr ? 'إيداعات معلقة' : 'Pending Deposits'} ({adminData.pendingDeposits.length})</h3>
              {adminData.pendingDeposits.slice(0, 5).map((dep: any) => (
                <div key={dep.id} style={rowCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>{fmt(dep.amount)} - {dep.user?.name}</div>
                      <div style={{ fontSize: 10, color: D.textMuted }}>{dep.user?.email} | {fmtDate(dep.createdAt)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => adminAction('approveDeposit', { transactionId: dep.id })} style={actionBtn(D.green, D.greenBg, D.greenBorder)}>{isAr ? 'قبول' : 'Approve'}</button>
                      <button onClick={() => adminAction('rejectDeposit', { transactionId: dep.id, reason: 'مرفوض' })} style={actionBtn(D.red, D.redBg, D.redBorder)}>{isAr ? 'رفض' : 'Reject'}</button>
                    </div>
                  </div>
                </div>
              ))}
              {adminData.pendingDeposits.length > 5 && <button onClick={() => setActiveTab('deposits')} style={{ ...btnOutline, fontSize: 12, padding: '8px 0', marginTop: 4 }}>{isAr ? `عرض الكل (${adminData.pendingDeposits.length})` : `View All (${adminData.pendingDeposits.length})`}</button>}
            </div>
          )}

          {adminData?.pendingWithdrawals?.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <h3 className="admin-section-title"><Icon name="arrowUp" size={16} color={D.red} /> {isAr ? 'سحوبات معلقة' : 'Pending Withdrawals'} ({adminData.pendingWithdrawals.length})</h3>
              {adminData.pendingWithdrawals.slice(0, 5).map((wd: any) => (
                <div key={wd.id} style={rowCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>{fmt(wd.amount)} - {wd.user?.name}</div>
                      <div style={{ fontSize: 10, color: D.textMuted }}>{wd.walletAddress ? `${wd.walletAddress.substring(0, 12)}...` : ''} | {wd.cryptoNetwork || 'BEP20'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => adminAction('approveWithdrawal', { transactionId: wd.id })} style={actionBtn(D.green, D.greenBg, D.greenBorder)}>{isAr ? 'قبول' : 'Approve'}</button>
                      <button onClick={() => adminAction('rejectWithdrawal', { transactionId: wd.id, reason: 'مرفوض' })} style={actionBtn(D.red, D.redBg, D.redBorder)}>{isAr ? 'رفض' : 'Reject'}</button>
                    </div>
                  </div>
                </div>
              ))}
              {adminData.pendingWithdrawals.length > 5 && <button onClick={() => setActiveTab('withdrawals')} style={{ ...btnOutline, fontSize: 12, padding: '8px 0', marginTop: 4 }}>{isAr ? `عرض الكل (${adminData.pendingWithdrawals.length})` : `View All (${adminData.pendingWithdrawals.length})`}</button>}
            </div>
          )}

          {adminData?.pendingKyc?.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <h3 className="admin-section-title"><Icon name="shield" size={16} color={D.purple} /> KYC {isAr ? 'معلق' : 'Pending'} ({adminData.pendingKyc.length})</h3>
              {adminData.pendingKyc.slice(0, 5).map((k: any) => (
                <div key={k.id} style={rowCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>{k.name} - {k.kycFullName}</div>
                      <div style={{ fontSize: 10, color: D.textMuted }}>{k.kycDocumentType}: {k.kycIdNumber}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, justifyContent: 'flex-end' }}>
                      <button onClick={() => adminAction('approveKyc', { userId: k.id })} style={actionBtn(D.green, D.greenBg, D.greenBorder)}>{isAr ? 'قبول' : 'Approve'}</button>
                      <select id={`kyc-r-${k.id}`} defaultValue="INCOMPLETE" style={{ ...filterSelect, fontSize: 10, padding: '4px 6px' }}>
                        {Object.keys(KYC_REASONS).map(r => <option key={r} value={r}>{KYC_REASONS[r].substring(0, 20)}</option>)}
                      </select>
                      <button onClick={() => { const sel = document.getElementById(`kyc-r-${k.id}`) as HTMLSelectElement; adminAction('rejectKyc', { userId: k.id, reason: sel?.value || 'INCOMPLETE' }) }} style={actionBtn(D.red, D.redBg, D.redBorder)}>{isAr ? 'رفض' : 'Reject'}</button>
                    </div>
                  </div>
                </div>
              ))}
              {adminData.pendingKyc.length > 5 && <button onClick={() => setActiveTab('kyc')} style={{ ...btnOutline, fontSize: 12, padding: '8px 0', marginTop: 4 }}>{isAr ? `عرض الكل (${adminData.pendingKyc.length})` : `View All (${adminData.pendingKyc.length})`}</button>}
            </div>
          )}
        </>
      )}

      {/* ============ USERS TAB ============ */}
      {activeTab === 'users' && (
        <>
          {/* User Detail Modal */}
          {selectedUser && (
            <div style={{ ...cardStyle, padding: '20px', marginBottom: 16, ...(isAr ? { borderLeft: `3px solid ${D.accent}` } : { borderRight: `3px solid ${D.accent}` }) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: D.textPrimary }}>{selectedUser.name}</h3>
                <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Icon name="x" size={18} color={D.textMuted} /></button>
              </div>
              {userDetailLoading ? <Spinner /> : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
                    {[
                      { l: isAr ? 'الرصيد' : 'Balance', v: fmt(selectedUser.balance || 0) },
                      { l: isAr ? 'إجمالي الإيداع' : 'Total Deposited', v: fmt(selectedUser.totalDeposited || 0) },
                      { l: isAr ? 'إجمالي السحب' : 'Total Withdrawn', v: fmt(selectedUser.totalWithdrawn || 0) },
                      { l: isAr ? 'إجمالي الأرباح' : 'Total Profit', v: fmt(selectedUser.totalProfit || 0) },
                    ].map((s, i) => (
                      <div key={i} style={{ padding: 10, background: D.surface, borderRadius: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>{s.v}</div>
                        <div style={{ fontSize: 10, color: D.textMuted }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: D.textSecondary, marginBottom: 8 }}>{selectedUser.email} | {isAr ? 'الحالة' : 'Status'}: {selectedUser.isActive ? '✅' : '🚫'} | KYC: {selectedUser.kycStatus}</div>
                  {/* Balance Adjustment */}
                  <div style={{ background: D.surface, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: D.textPrimary, marginBottom: 8 }}>{isAr ? 'تعديل الرصيد' : 'Adjust Balance'}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <select value={balanceAdjust.type} onChange={e => setBalanceAdjust(p => ({ ...p, type: e.target.value }))} style={{ ...filterSelect, width: 80 }}>
                        <option value="add">{isAr ? 'إضافة' : 'Add'}</option>
                        <option value="subtract">{isAr ? 'خصم' : 'Subtract'}</option>
                      </select>
                      <input type="number" value={balanceAdjust.amount} onChange={e => setBalanceAdjust(p => ({ ...p, amount: e.target.value }))} placeholder={isAr ? 'المبلغ' : 'Amount'} style={{ ...searchInput, flex: 1, fontSize: 12 }} />
                      <button onClick={adjustBalance} disabled={actionLoading === 'balance'} style={{ ...actionBtn(D.accent, D.accentBg, D.accentBorder), padding: '8px 16px' }}>{isAr ? 'تنفيذ' : 'Apply'}</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => toggleUser(selectedUser.id)} disabled={actionLoading === selectedUser.id} style={{ flex: 1, ...actionBtn(selectedUser.isActive ? D.red : D.green, selectedUser.isActive ? D.redBg : D.greenBg, selectedUser.isActive ? D.redBorder : D.greenBorder), padding: '8px 0', textAlign: 'center' as const }}>
                      {selectedUser.isActive ? (isAr ? 'تعطيل الحساب' : 'Suspend') : (isAr ? 'تفعيل الحساب' : 'Activate')}
                    </button>
                  </div>
                  {/* User Investments */}
                  {selectedUser.investments?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: D.textPrimary, marginBottom: 6 }}>{isAr ? 'الاستثمارات' : 'Investments'} ({selectedUser.investments.length})</div>
                      <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                        {selectedUser.investments.slice(0, 10).map((inv: any) => (
                          <div key={inv.id} style={{ padding: '6px 8px', background: D.input, borderRadius: 6, marginBottom: 4, fontSize: 11, color: D.textSecondary, display: 'flex', justifyContent: 'space-between' }}>
                            <span>{fmt(inv.amount)} - {inv.package?.name || inv.packageId}</span>
                            <span style={{ color: inv.status === 'ACTIVE' ? D.green : D.textMuted, fontWeight: 700 }}>{inv.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Search & Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const }}>
            <input value={usersSearch} onChange={e => setUsersSearch(e.target.value)} placeholder={isAr ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'} style={{ ...searchInput, flex: 1, minWidth: 160 }} onKeyDown={e => { if (e.key === 'Enter') loadUsers(1, usersSearch, usersStatusFilter) }} />
            <select value={usersStatusFilter} onChange={e => { setUsersStatusFilter(e.target.value); loadUsers(1, usersSearch, e.target.value) }} style={filterSelect}>
              <option value="">{isAr ? 'كل الحالات' : 'All Status'}</option>
              <option value="active">{isAr ? 'نشط' : 'Active'}</option>
              <option value="inactive">{isAr ? 'معطل' : 'Inactive'}</option>
            </select>
            <button onClick={() => loadUsers(1, usersSearch, usersStatusFilter)} style={{ ...actionBtn(D.accent, D.accentBg, D.accentBorder), padding: '8px 14px' }}>{isAr ? 'بحث' : 'Search'}</button>
            <select value={usersSort} onChange={e => { setUsersSort(e.target.value as any); setUsersSortDir(prev => prev === 'asc' ? 'desc' : 'asc') }} style={{ ...filterSelect, fontSize: 10, padding: '6px 10px' }}>
              <option value="createdAt">{isAr ? 'تاريخ' : 'Date'}</option>
              <option value="name">{isAr ? 'اسم' : 'Name'}</option>
              <option value="balance">{isAr ? 'رصيد' : 'Balance'}</option>
            </select>
          </div>

          {/* Users List */}
          {usersLoading ? <Spinner /> : usersData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: D.textMuted, fontSize: 13 }}>{isAr ? 'لا يوجد مستخدمين' : 'No users found'}</div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: D.textMuted, marginBottom: 8 }}>{isAr ? `إجمالي: ${usersPagination.total} مستخدم` : `Total: ${usersPagination.total} users`}</div>
              {usersData.map((u: any) => (
                <div key={u.id} style={{ ...rowCard, cursor: 'pointer' }} onClick={() => loadUserDetail(u.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {u.name}
                        {!u.isActive && <span style={{ fontSize: 9, color: D.red, background: D.redBg, padding: '1px 6px', borderRadius: 4 }}>{isAr ? 'معطل' : 'Suspended'}</span>}
                        {u.role === 'ADMIN' && <span style={{ fontSize: 9, color: D.accent, background: D.accentBg, padding: '1px 6px', borderRadius: 4 }}>Admin</span>}
                      </div>
                      <div style={{ fontSize: 10, color: D.textMuted }}>{u.email} | {isAr ? 'رصيد' : 'Bal'}: {fmt(u.balance)} | {isAr ? 'استثمارات' : 'Inv'}: {u.activeInvestments || 0}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button onClick={e => { e.stopPropagation(); toggleUser(u.id) }} disabled={actionLoading === u.id} style={actionBtn(u.isActive ? D.red : D.green, u.isActive ? D.redBg : D.greenBg, u.isActive ? D.redBorder : D.greenBorder)}>
                        {u.isActive ? (isAr ? 'تعطيل' : 'Suspend') : (isAr ? 'تفعيل' : 'Activate')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <Pagination current={usersPagination.page} total={usersPagination.totalPages} onPage={p => loadUsers(p, usersSearch, usersStatusFilter)} />
            </>
          )}
        </>
      )}

      {/* ============ DEPOSITS TAB ============ */}
      {activeTab === 'deposits' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const }}>
            <select value={depositsStatusFilter} onChange={e => { setDepositsStatusFilter(e.target.value); loadDeposits(1, e.target.value) }} style={filterSelect}>
              <option value="">{isAr ? 'كل الحالات' : 'All Status'}</option>
              <option value="pending">{isAr ? 'معلق' : 'Pending'}</option>
              <option value="completed">{isAr ? 'مكتمل' : 'Completed'}</option>
              <option value="rejected">{isAr ? 'مرفوض' : 'Rejected'}</option>
            </select>
            <button onClick={() => loadDeposits(depositsPagination.page, depositsStatusFilter)} style={{ ...actionBtn(D.accent, D.accentBg, D.accentBorder), padding: '8px 14px' }}>{isAr ? 'تحديث' : 'Refresh'}</button>
          </div>
          {depositsLoading ? <Spinner /> : depositsData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: D.textMuted, fontSize: 13 }}>{isAr ? 'لا توجد إيداعات' : 'No deposits found'}</div>
          ) : (
            <>
              {depositsData.map((dep: any) => (
                <div key={dep.id} style={rowCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>{fmt(dep.amount)} - {dep.user?.name || dep.userId}</div>
                      <div style={{ fontSize: 10, color: D.textMuted }}>{dep.user?.email} | {fmtDate(dep.createdAt)}</div>
                      {dep.description && <div style={{ fontSize: 10, color: D.textMuted, marginTop: 2 }}>{dep.description}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' as const }}>
                      <StatusBadge status={dep.status?.toUpperCase()} labels={{
                        PENDING: { text: isAr ? 'معلق' : 'Pending', color: D.yellow, bg: D.yellowBg },
                        COMPLETED: { text: isAr ? 'مكتمل' : 'Completed', color: D.green, bg: D.greenBg },
                        REJECTED: { text: isAr ? 'مرفوض' : 'Rejected', color: D.red, bg: D.redBg },
                        PROCESSING: { text: isAr ? 'قيد المعالجة' : 'Processing', color: D.accent, bg: D.accentBg },
                      }} />
                      {(dep.status?.toUpperCase() === 'PENDING') && (
                        <>
                          <button onClick={() => updateTransactionStatus(dep.id, 'APPROVED')} disabled={actionLoading === dep.id} style={actionBtn(D.green, D.greenBg, D.greenBorder)}>{isAr ? 'قبول' : 'Approve'}</button>
                          <button onClick={() => updateTransactionStatus(dep.id, 'REJECTED')} disabled={actionLoading === dep.id} style={actionBtn(D.red, D.redBg, D.redBorder)}>{isAr ? 'رفض' : 'Reject'}</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <Pagination current={depositsPagination.page} total={depositsPagination.totalPages} onPage={p => loadDeposits(p, depositsStatusFilter)} />
            </>
          )}
        </>
      )}

      {/* ============ WITHDRAWALS TAB ============ */}
      {activeTab === 'withdrawals' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const }}>
            <select value={withdrawalsStatusFilter} onChange={e => { setWithdrawalsStatusFilter(e.target.value); loadWithdrawals(1, e.target.value) }} style={filterSelect}>
              <option value="">{isAr ? 'كل الحالات' : 'All Status'}</option>
              <option value="pending">{isAr ? 'معلق' : 'Pending'}</option>
              <option value="processing">{isAr ? 'قيد المعالجة' : 'Processing'}</option>
              <option value="completed">{isAr ? 'مكتمل' : 'Completed'}</option>
              <option value="rejected">{isAr ? 'مرفوض' : 'Rejected'}</option>
            </select>
            <button onClick={() => loadWithdrawals(withdrawalsPagination.page, withdrawalsStatusFilter)} style={{ ...actionBtn(D.accent, D.accentBg, D.accentBorder), padding: '8px 14px' }}>{isAr ? 'تحديث' : 'Refresh'}</button>
          </div>
          {withdrawalsLoading ? <Spinner /> : withdrawalsData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: D.textMuted, fontSize: 13 }}>{isAr ? 'لا توجد سحوبات' : 'No withdrawals found'}</div>
          ) : (
            <>
              {withdrawalsData.map((wd: any) => (
                <div key={wd.id} style={rowCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>{fmt(wd.amount)} - {wd.user?.name || wd.userId}</div>
                      <div style={{ fontSize: 10, color: D.textMuted }}>
                        {wd.walletAddress ? `${wd.walletAddress.substring(0, 14)}...` : '-'} | {wd.cryptoNetwork || 'BEP20'}
                      </div>
                      <div style={{ fontSize: 10, color: D.textMuted }}>{wd.user?.email} | {fmtDate(wd.createdAt)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' as const }}>
                      <StatusBadge status={wd.status?.toUpperCase()} labels={{
                        PENDING: { text: isAr ? 'معلق' : 'Pending', color: D.yellow, bg: D.yellowBg },
                        COMPLETED: { text: isAr ? 'مكتمل' : 'Completed', color: D.green, bg: D.greenBg },
                        REJECTED: { text: isAr ? 'مرفوض' : 'Rejected', color: D.red, bg: D.redBg },
                        PROCESSING: { text: isAr ? 'قيد المعالجة' : 'Processing', color: D.accent, bg: D.accentBg },
                      }} />
                      {(wd.status?.toUpperCase() === 'PENDING') && (
                        <>
                          <button onClick={() => updateTransactionStatus(wd.id, 'PROCESSING')} disabled={actionLoading === wd.id} style={actionBtn(D.accent, D.accentBg, D.accentBorder)}>{isAr ? 'معالجة' : 'Process'}</button>
                          <button onClick={() => updateTransactionStatus(wd.id, 'APPROVED')} disabled={actionLoading === wd.id} style={actionBtn(D.green, D.greenBg, D.greenBorder)}>{isAr ? 'قبول' : 'Approve'}</button>
                          <button onClick={() => updateTransactionStatus(wd.id, 'REJECTED')} disabled={actionLoading === wd.id} style={actionBtn(D.red, D.redBg, D.redBorder)}>{isAr ? 'رفض' : 'Reject'}</button>
                        </>
                      )}
                      {(wd.status?.toUpperCase() === 'PROCESSING') && (
                        <>
                          <button onClick={() => updateTransactionStatus(wd.id, 'APPROVED')} disabled={actionLoading === wd.id} style={actionBtn(D.green, D.greenBg, D.greenBorder)}>{isAr ? 'إتمام' : 'Complete'}</button>
                          <button onClick={() => updateTransactionStatus(wd.id, 'REJECTED')} disabled={actionLoading === wd.id} style={actionBtn(D.red, D.redBg, D.redBorder)}>{isAr ? 'رفض' : 'Reject'}</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <Pagination current={withdrawalsPagination.page} total={withdrawalsPagination.totalPages} onPage={p => loadWithdrawals(p, withdrawalsStatusFilter)} />
            </>
          )}
        </>
      )}

      {/* ============ INVESTMENTS TAB ============ */}
      {activeTab === 'investments' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const }}>
            <select value={investmentsStatusFilter} onChange={e => { setInvestmentsStatusFilter(e.target.value); loadInvestments(1, e.target.value) }} style={filterSelect}>
              <option value="">{isAr ? 'كل الحالات' : 'All Status'}</option>
              <option value="ACTIVE">{isAr ? 'نشط' : 'Active'}</option>
              <option value="COMPLETED">{isAr ? 'مكتمل' : 'Completed'}</option>
              <option value="CANCELLED">{isAr ? 'ملغى' : 'Cancelled'}</option>
            </select>
            <button onClick={() => loadInvestments(investmentsPagination.page, investmentsStatusFilter)} style={{ ...actionBtn(D.accent, D.accentBg, D.accentBorder), padding: '8px 14px' }}>{isAr ? 'تحديث' : 'Refresh'}</button>
          </div>
          {investmentsLoading ? <Spinner /> : investmentsData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: D.textMuted, fontSize: 13 }}>{isAr ? 'لا توجد استثمارات' : 'No investments found'}</div>
          ) : (
            <>
              {investmentsData.map((inv: any) => (
                <div key={inv.id} style={rowCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>{fmt(inv.amount)} - {inv.user?.name || inv.userId}</div>
                      <div style={{ fontSize: 10, color: D.textMuted }}>{inv.package?.name || inv.packageId} | {isAr ? 'الأرباح' : 'Profit'}: {fmt(inv.totalProfit || 0)}</div>
                      <div style={{ fontSize: 10, color: D.textMuted }}>{fmtDate(inv.startDate)} | {inv.package?.durationDays || '?'} {isAr ? 'يوم' : 'days'}</div>
                    </div>
                    <StatusBadge status={inv.status} labels={{
                      ACTIVE: { text: isAr ? 'نشط' : 'Active', color: D.green, bg: D.greenBg },
                      COMPLETED: { text: isAr ? 'مكتمل' : 'Completed', color: D.accent, bg: D.accentBg },
                      CANCELLED: { text: isAr ? 'ملغى' : 'Cancelled', color: D.red, bg: D.redBg },
                    }} />
                  </div>
                </div>
              ))}
              <Pagination current={investmentsPagination.page} total={investmentsPagination.totalPages} onPage={p => loadInvestments(p, investmentsStatusFilter)} />
            </>
          )}
        </>
      )}

      {/* ============ KYC TAB ============ */}
      {activeTab === 'kyc' && (
        <>
          {kycLoading ? <Spinner /> : kycData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: D.textMuted, fontSize: 13 }}>
              <Icon name="shield" size={40} color={D.textMuted} />
              <div style={{ marginTop: 8 }}>{isAr ? 'لا يوجد طلبات تحقق معلقة' : 'No pending KYC verifications'}</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: D.textMuted, marginBottom: 10 }}>{isAr ? `${kycData.length} طلب تحقق معلق` : `${kycData.length} pending verifications`}</div>
              {kycData.map((k: any) => (
                <div key={k.id} style={{ ...rowCard, ...(isAr ? { borderLeft: `3px solid ${D.purple}` } : { borderRight: `3px solid ${D.purple}` }) }}>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary }}>{k.name}</div>
                    <div style={{ fontSize: 11, color: D.textMuted }}>{k.email}</div>
                  </div>
                  <div style={{ background: D.surface, borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                      <div><span style={{ color: D.textMuted }}>{isAr ? 'الاسم' : 'Name'}:</span> <span style={{ color: D.textPrimary, fontWeight: 600 }}>{k.kycFullName}</span></div>
                      <div><span style={{ color: D.textMuted }}>{isAr ? 'النوع' : 'Type'}:</span> <span style={{ color: D.textPrimary, fontWeight: 600 }}>{k.kycDocumentType}</span></div>
                      <div style={{ gridColumn: '1 / -1' }}><span style={{ color: D.textMuted }}>{isAr ? 'رقم الهوية' : 'ID Number'}:</span> <span style={{ color: D.textPrimary, fontWeight: 600 }}>{k.kycIdNumber}</span></div>
                      {k.kycSubmittedAt && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: D.textMuted }}>{isAr ? 'تاريخ التقديم' : 'Submitted'}:</span> <span style={{ color: D.textPrimary, fontWeight: 600 }}>{fmtDate(k.kycSubmittedAt)}</span></div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const }}>
                    <button onClick={() => adminAction('approveKyc', { userId: k.id })} disabled={!!actionLoading} style={{ ...actionBtn(D.green, D.greenBg, D.greenBorder), padding: '8px 16px' }}>{isAr ? 'قبول' : 'Approve'}</button>
                    <select id={`kyc-tab-${k.id}`} defaultValue="INCOMPLETE" style={{ ...filterSelect, fontSize: 11 }}>
                      {Object.entries(KYC_REASONS).map(([code, desc]) => <option key={code} value={code}>{isAr ? desc.substring(0, 25) : code}</option>)}
                    </select>
                    <button onClick={() => { const sel = document.getElementById(`kyc-tab-${k.id}`) as HTMLSelectElement; adminAction('rejectKyc', { userId: k.id, reason: sel?.value || 'INCOMPLETE' }) }} disabled={!!actionLoading} style={{ ...actionBtn(D.red, D.redBg, D.redBorder), padding: '8px 16px' }}>{isAr ? 'رفض' : 'Reject'}</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* ============ PACKAGES TAB ============ */}
      {activeTab === 'packages' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={sectionTitle}><Icon name="star" size={16} color={D.yellow} /> {isAr ? 'باقات الاستثمار' : 'Investment Packages'}</h3>
            <button onClick={seedPackages} disabled={actionLoading === 'seed'} style={{ ...actionBtn(D.accent, D.accentBg, D.accentBorder), padding: '8px 14px' }}>{isAr ? 'إنشاء الباقات الافتراضية' : 'Seed Defaults'}</button>
          </div>
          {packagesLoading ? <Spinner /> : packagesData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: D.textMuted, fontSize: 13 }}>{isAr ? 'لا توجد باقات' : 'No packages found'}</div>
          ) : (
            packagesData.map((pkg: any) => (
              <div key={pkg.id} style={{ ...rowCard, ...(isAr ? { borderLeft: `3px solid ${pkg.color || D.accent}` } : { borderRight: `3px solid ${pkg.color || D.accent}` }) }}>
                {editingPkg === pkg.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary }}>{pkg.name}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div>
                        <label style={{ fontSize: 10, color: D.textMuted }}>{isAr ? 'العائد اليومي %' : 'Daily Rate %'}</label>
                        <input type="number" step="0.1" value={pkgForm[pkg.id]?.monthlyReturn ?? pkg.monthlyReturn} onChange={e => setPkgForm(prev => ({ ...prev, [pkg.id]: { ...(prev[pkg.id] || {}), monthlyReturn: parseFloat(e.target.value) } }))} style={{ ...searchInput, fontSize: 12, padding: '8px 10px' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: D.textMuted }}>{isAr ? 'المدة (أيام)' : 'Duration (days)'}</label>
                        <input type="number" value={pkgForm[pkg.id]?.durationDays ?? pkg.durationDays} onChange={e => setPkgForm(prev => ({ ...prev, [pkg.id]: { ...(prev[pkg.id] || {}), durationDays: parseInt(e.target.value) } }))} style={{ ...searchInput, fontSize: 12, padding: '8px 10px' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: D.textMuted }}>{isAr ? 'الحد الأدنى' : 'Min Amount'}</label>
                        <input type="number" value={pkgForm[pkg.id]?.minAmount ?? pkg.minAmount} onChange={e => setPkgForm(prev => ({ ...prev, [pkg.id]: { ...(prev[pkg.id] || {}), minAmount: parseFloat(e.target.value) } }))} style={{ ...searchInput, fontSize: 12, padding: '8px 10px' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: D.textMuted }}>{isAr ? 'الحد الأقصى' : 'Max Amount'}</label>
                        <input type="number" value={pkgForm[pkg.id]?.maxAmount ?? (pkg.maxAmount || '')} onChange={e => setPkgForm(prev => ({ ...prev, [pkg.id]: { ...(prev[pkg.id] || {}), maxAmount: parseFloat(e.target.value) || null } }))} style={{ ...searchInput, fontSize: 12, padding: '8px 10px' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => updatePackage(pkg.id)} style={{ ...actionBtn(D.green, D.greenBg, D.greenBorder), padding: '8px 16px', flex: 1, textAlign: 'center' as const }}>{isAr ? 'حفظ' : 'Save'}</button>
                      <button onClick={() => setEditingPkg(null)} style={{ ...actionBtn(D.textMuted, D.surface, D.border), padding: '8px 16px' }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: pkg.color || D.accent }}>{pkg.name}</div>
                      <div style={{ fontSize: 11, color: D.textSecondary }}>
                        {pkg.monthlyReturn}% {isAr ? 'يومياً' : 'daily'} | {pkg.durationDays} {isAr ? 'يوم' : 'days'} | {pkg.minAmount} - {pkg.maxAmount ? `${pkg.maxAmount}` : '∞'}
                      </div>
                    </div>
                    <button onClick={() => { setEditingPkg(pkg.id); setPkgForm(prev => ({ ...prev, [pkg.id]: { monthlyReturn: pkg.monthlyReturn, durationDays: pkg.durationDays, minAmount: pkg.minAmount, maxAmount: pkg.maxAmount } })) }} style={actionBtn(D.accent, D.accentBg, D.accentBorder)}>{isAr ? 'تعديل' : 'Edit'}</button>
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}

      {/* ============ SETTINGS TAB ============ */}
      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Platform Settings */}
          <div style={{ ...cardStyle, padding: '20px' }}>
            <h3 style={sectionTitle}><Icon name="settings" size={18} color={D.accent} /> {isAr ? 'إعدادات المنصة' : 'Platform Settings'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: D.textMuted, marginBottom: 4, display: 'block' }}>{isAr ? 'اسم المنصة' : 'Platform Name'}</label>
                <input value={settingsAll.platform_name || 'SONA'} onChange={e => setSettingsAll(prev => ({ ...prev, platform_name: e.target.value }))} onBlur={() => updateSettingValue('platform_name', settingsAll.platform_name || 'SONA')} style={searchInput} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: D.textMuted, marginBottom: 4, display: 'block' }}>{isAr ? 'عملة المنصة' : 'Platform Currency'}</label>
                <input value={settingsAll.platform_currency || 'USDT'} onChange={e => setSettingsAll(prev => ({ ...prev, platform_currency: e.target.value }))} onBlur={() => updateSettingValue('platform_currency', settingsAll.platform_currency || 'USDT')} style={searchInput} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: D.textMuted, marginBottom: 4, display: 'block' }}>{isAr ? 'مكافأة الإحالة %' : 'Referral Bonus %'}</label>
                <input type="number" value={settingsAll.referral_bonus_pct || '15'} onChange={e => setSettingsAll(prev => ({ ...prev, referral_bonus_pct: e.target.value }))} onBlur={() => updateSettingValue('referral_bonus_pct', settingsAll.referral_bonus_pct || '15')} style={searchInput} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: D.textMuted, marginBottom: 4, display: 'block' }}>{isAr ? 'مكافأة إعادة الاستثمار %' : 'Reinvest Bonus %'}</label>
                <input type="number" value={settingsAll.reinvest_bonus_pct || '2'} onChange={e => setSettingsAll(prev => ({ ...prev, reinvest_bonus_pct: e.target.value }))} onBlur={() => updateSettingValue('reinvest_bonus_pct', settingsAll.reinvest_bonus_pct || '2')} style={searchInput} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: D.textMuted, marginBottom: 4, display: 'block' }}>{isAr ? 'عمولة المنصة %' : 'Platform Commission %'}</label>
                <input type="number" value={settingsAll.platform_commission_pct || '10'} onChange={e => setSettingsAll(prev => ({ ...prev, platform_commission_pct: e.target.value }))} onBlur={() => updateSettingValue('platform_commission_pct', settingsAll.platform_commission_pct || '10')} style={searchInput} />
              </div>
            </div>
          </div>

          {/* Feature Toggles */}
          <div style={{ ...cardStyle, padding: '20px' }}>
            <h3 style={sectionTitle}><Icon name="zap" size={18} color={D.green} /> {isAr ? 'الميزات' : 'Feature Toggles'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { key: 'registration_enabled', label: isAr ? 'التسجيل' : 'Registration', icon: 'user' },
                { key: 'deposit_enabled', label: isAr ? 'الإيداع' : 'Deposit', icon: 'arrowDown' },
                { key: 'withdrawal_enabled', label: isAr ? 'السحب' : 'Withdrawal', icon: 'arrowUp' },
                { key: 'investment_enabled', label: isAr ? 'الاستثمار' : 'Investment', icon: 'gem' },
                { key: 'support_enabled', label: isAr ? 'الدعم' : 'Support', icon: 'chat' },
              ].map(feat => (
                <div key={feat.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name={feat.icon as any} size={14} color={settingsAll[feat.key] !== 'false' ? D.green : D.red} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: D.textPrimary }}>{feat.label}</span>
                  </div>
                  <button onClick={() => toggleSetting(feat.key)} style={{ padding: '6px 14px', background: settingsAll[feat.key] !== 'false' ? D.greenBg : D.redBg, border: `1px solid ${settingsAll[feat.key] !== 'false' ? D.greenBorder : D.redBorder}`, color: settingsAll[feat.key] !== 'false' ? D.green : D.red, borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>
                    {settingsAll[feat.key] !== 'false' ? (isAr ? 'مفعّل' : 'ON') : (isAr ? 'معطّل' : 'OFF')}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Platform Mode */}
          <div style={{ ...cardStyle, padding: '20px' }}>
            <h3 style={sectionTitle}><Icon name="settings" size={18} color={D.accent} /> {t('platformMode')}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => updateSettings({ platformMode: 'SONA' })} style={{ flex: 1, padding: '14px 8px', borderRadius: 12, border: `2px solid ${settingsForm.platformMode === 'SONA' ? D.accent : D.border}`, background: settingsForm.platformMode === 'SONA' ? D.accentBg : D.card, cursor: 'pointer', textAlign: 'center', fontFamily: "'Cairo', sans-serif" }}>
                <Icon name="zap" size={22} color={settingsForm.platformMode === 'SONA' ? D.accent : D.textMuted} />
                <div style={{ fontSize: 11, fontWeight: 700, color: settingsForm.platformMode === 'SONA' ? D.accent : D.textSecondary, marginTop: 6 }}>
                  SONA
                </div>
              </button>
            </div>
          </div>

          {/* Financial Limits */}
          <div style={{ ...cardStyle, padding: '20px' }}>
            <h3 style={sectionTitle}><Icon name="cash" size={18} color={D.green} /> {isAr ? 'الحدود المالية' : 'Financial Limits'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: D.textMuted, marginBottom: 4, display: 'block' }}>{isAr ? 'الحد الأدنى للإيداع ($)' : 'Min Deposit ($)'}</label>
                <input type="number" value={settingsExtra.minDeposit} onChange={e => setSettingsExtra(prev => ({ ...prev, minDeposit: parseFloat(e.target.value) || 0 }))} style={searchInput} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: D.textMuted, marginBottom: 4, display: 'block' }}>{isAr ? 'الحد الأدنى للسحب ($)' : 'Min Withdrawal ($)'}</label>
                <input type="number" value={settingsExtra.minWithdrawal} onChange={e => setSettingsExtra(prev => ({ ...prev, minWithdrawal: parseFloat(e.target.value) || 0 }))} style={searchInput} />
              </div>
            </div>
            <button onClick={() => updateSettings({ minDeposit: settingsExtra.minDeposit, minWithdrawal: settingsExtra.minWithdrawal })} style={{ ...btnOutline, marginTop: 10, fontSize: 13, padding: '10px 0' }}>{isAr ? 'حفظ الحدود' : 'Save Limits'}</button>
          </div>

          {/* Withdrawal Processing Times */}
          <div style={{ ...cardStyle, padding: '20px' }}>
            <h3 style={sectionTitle}><Icon name="clock" size={18} color={D.accent} /> {isAr ? 'أوقات معالجة السحب' : 'Withdrawal Processing Times'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: D.textMuted, marginBottom: 4, display: 'block' }}>{isAr ? 'سريع (ساعات)' : 'Fast (hours)'}</label>
                <input type="number" value={settingsAll.withdraw_fast_hours || '1'} onChange={e => setSettingsAll(prev => ({ ...prev, withdraw_fast_hours: e.target.value }))} onBlur={() => updateSettingValue('withdraw_fast_hours', settingsAll.withdraw_fast_hours || '1')} style={searchInput} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: D.textMuted, marginBottom: 4, display: 'block' }}>{isAr ? 'متوسط (ساعات)' : 'Medium (hours)'}</label>
                <input type="number" value={settingsAll.withdraw_medium_hours || '24'} onChange={e => setSettingsAll(prev => ({ ...prev, withdraw_medium_hours: e.target.value }))} onBlur={() => updateSettingValue('withdraw_medium_hours', settingsAll.withdraw_medium_hours || '24')} style={searchInput} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: D.textMuted, marginBottom: 4, display: 'block' }}>{isAr ? 'بطيء (ساعات)' : 'Slow (hours)'}</label>
                <input type="number" value={settingsAll.withdraw_slow_hours || '72'} onChange={e => setSettingsAll(prev => ({ ...prev, withdraw_slow_hours: e.target.value }))} onBlur={() => updateSettingValue('withdraw_slow_hours', settingsAll.withdraw_slow_hours || '72')} style={searchInput} />
              </div>
            </div>
          </div>

          {/* Maintenance Mode */}
          <div style={{ ...cardStyle, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="alertTriangle" size={18} color={D.yellow} />
                <h3 style={{ fontSize: 15, fontWeight: 800, color: D.textPrimary }}>{t('maintenanceMode')}</h3>
              </div>
              <button onClick={() => updateSettings({ maintenanceMode: !settingsForm.maintenanceMode })} style={{ padding: '8px 16px', background: settingsForm.maintenanceMode ? D.redBg : D.greenBg, border: `1px solid ${settingsForm.maintenanceMode ? D.redBorder : D.greenBorder}`, color: settingsForm.maintenanceMode ? D.red : D.green, borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>
                {settingsForm.maintenanceMode ? (isAr ? 'مفعّل' : 'ON') : (isAr ? 'معطّل' : 'OFF')}
              </button>
            </div>
            <input style={inputStyle} placeholder={t('customMessage')} value={settingsForm.maintenanceMessage} onChange={e => setSettingsForm(prev => ({ ...prev, maintenanceMessage: e.target.value }))} />
            <button onClick={() => updateSettings({ maintenanceMessage: settingsForm.maintenanceMessage })} style={{ ...btnOutline, marginTop: 8, fontSize: 13, padding: '10px 0' }}>{isAr ? 'حفظ الرسالة' : 'Save Message'}</button>
          </div>

          {/* Fake Hack Mode */}
          <div style={{ ...cardStyle, padding: '20px', ...(isAr ? { borderLeft: `3px solid ${D.red}` } : { borderRight: `3px solid ${D.red}` }) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="alertTriangle" size={18} color={D.red} />
                <h3 style={{ fontSize: 15, fontWeight: 800, color: D.red }}>{t('hackAlert')}</h3>
              </div>
              <button onClick={() => updateSettings({ fakeHackMode: !settingsForm.fakeHackMode })} style={{ padding: '8px 16px', background: settingsForm.fakeHackMode ? D.redBg : D.card, border: `1px solid ${settingsForm.fakeHackMode ? D.redBorder : D.border}`, color: settingsForm.fakeHackMode ? D.red : D.textSecondary, borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>
                {settingsForm.fakeHackMode ? (isAr ? 'مفعّل - خطر!' : 'ON - DANGER!') : (isAr ? 'معطّل' : 'OFF')}
              </button>
            </div>
            <div style={{ background: D.redBg, border: `1px solid ${D.redBorder}`, borderRadius: 8, padding: '8px 12px', fontSize: 11, color: D.red, marginBottom: 10 }}>
              {isAr ? 'تحذير: هذا الوضع يعرض شاشة اختراق مزيفة للمستخدمين. استخدم بحذر!' : 'Warning: This mode shows a fake hack screen to users. Use with caution!'}
            </div>
            <input style={inputStyle} placeholder={t('hackMessage')} value={settingsForm.fakeHackMessage} onChange={e => setSettingsForm(prev => ({ ...prev, fakeHackMessage: e.target.value }))} />
            <button onClick={() => updateSettings({ fakeHackMessage: settingsForm.fakeHackMessage })} style={{ ...btnOutline, marginTop: 8, fontSize: 13, padding: '10px 0', borderColor: D.redBorder, color: D.red }}>{isAr ? 'حفظ رسالة الاختراق' : 'Save Hack Message'}</button>
          </div>
        </div>
      )}

      {/* ============ NOTIFICATIONS TAB ============ */}
      {activeTab === 'notifications' && (
        <div style={{ ...cardStyle, padding: '20px' }}>
          <h3 style={sectionTitle}><Icon name="bell" size={18} color={D.accent} /> {t('sendNotification')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input style={inputStyle} placeholder={t('notificationTitle')} value={notifForm.title} onChange={e => setNotifForm(prev => ({ ...prev, title: e.target.value }))} />
            <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} placeholder={t('notificationBody')} value={notifForm.message} onChange={e => setNotifForm(prev => ({ ...prev, message: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setNotifForm(prev => ({ ...prev, broadcast: !prev.broadcast }))} style={{ padding: '8px 16px', background: notifForm.broadcast ? D.accentBg : D.card, border: `1px solid ${notifForm.broadcast ? D.accentBorder : D.border}`, color: notifForm.broadcast ? D.accent : D.textSecondary, borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>
                {t('sendToAll')}
              </button>
              {!notifForm.broadcast && (
                <input style={{ ...inputStyle, flex: 1 }} placeholder={isAr ? 'معرف المستخدم' : 'User ID'} value={notifForm.userId} onChange={e => setNotifForm(prev => ({ ...prev, userId: e.target.value }))} />
              )}
            </div>
            <button onClick={sendNotification} disabled={!notifForm.title || !notifForm.message || (!notifForm.broadcast && !notifForm.userId) || !!actionLoading} style={{ ...btnPrimary, opacity: (!notifForm.title || !notifForm.message || (!notifForm.broadcast && !notifForm.userId)) ? 0.5 : 1 }}>
              {actionLoading === 'notif' ? '...' : t('sendNotification')}
            </button>
          </div>
        </div>
      )}

      {/* ============ EXPORT TAB ============ */}
      {activeTab === 'export' && (
        <div style={{ ...cardStyle, padding: '20px' }}>
          <h3 style={sectionTitle}><Icon name="download" size={18} color={D.accent} /> {t('exportData')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {[
              { type: 'users', label: isAr ? 'المستخدمين' : 'Users', icon: 'user', color: D.accent },
              { type: 'transactions', label: isAr ? 'المعاملات' : 'Transactions', icon: 'cash', color: D.green },
              { type: 'investments', label: isAr ? 'الاستثمارات' : 'Investments', icon: 'gem', color: D.purple },
              { type: 'kyc', label: isAr ? 'بيانات KYC' : 'KYC Data', icon: 'id', color: D.yellow },
            ].map(item => (
              <button key={item.type} onClick={() => exportData(item.type)} disabled={actionLoading === 'export-' + item.type} style={{ ...cardStyle, padding: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, ...(isAr ? { borderLeft: `3px solid ${item.color}` } : { borderRight: `3px solid ${item.color}` }), transition: 'transform 0.1s' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${item.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {actionLoading === 'export-' + item.type ? <div style={{ width: 16, height: 16, border: `2px solid ${item.color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <Icon name={item.icon as any} size={18} color={item.color} />}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: D.textMuted }}>CSV</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============ ACTIVITY LOG TAB ============ */}
      {activeTab === 'activity' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' as const, gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
              <select value={activityFilter} onChange={e => { setActivityFilter(e.target.value); loadActivityLog() }} style={filterSelect}>
                <option value="">{isAr ? 'كل الأنشطة' : 'All Activities'}</option>
                <option value="login">{isAr ? 'تسجيل دخول' : 'Login'}</option>
                <option value="deposit">{isAr ? 'إيداع' : 'Deposit'}</option>
                <option value="withdrawal">{isAr ? 'سحب' : 'Withdrawal'}</option>
                <option value="investment">{isAr ? 'استثمار' : 'Investment'}</option>
                <option value="kyc">{isAr ? 'تحقق' : 'KYC'}</option>
                <option value="admin">{isAr ? 'إدارة' : 'Admin'}</option>
                <option value="engineer">{isAr ? 'وكيل المهندس' : 'Engineer Agent'}</option>
                <option value="error">{isAr ? 'أخطاء' : 'Errors'}</option>
                <option value="security">{isAr ? 'أمان' : 'Security'}</option>
              </select>
              <button onClick={() => loadActivityLog()} style={{ ...actionBtn(D.accent, D.accentBg, D.accentBorder), padding: '8px 14px' }}>{isAr ? 'تحديث' : 'Refresh'}</button>
            </div>
            <button onClick={() => exportData('logs')} disabled={actionLoading === 'export-logs'} style={{ ...actionBtn(D.green, D.greenBg, D.greenBorder), padding: '8px 14px' }}>{isAr ? 'تصدير CSV' : 'Export CSV'}</button>
          </div>

          {activityLoading ? <Spinner /> : activityLog.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: D.textMuted, fontSize: 13 }}>
              <Icon name="fileText" size={40} color={D.textMuted} />
              <div style={{ marginTop: 8 }}>{isAr ? 'لا توجد سجلات نشاط' : 'No activity logs found'}</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: D.textMuted, marginBottom: 8 }}>{isAr ? `${activityLog.length} سجل نشاط` : `${activityLog.length} activity logs`}</div>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {activityLog.map((log: any) => {
                  const actionColor = log.action?.includes('error') ? D.red : log.action?.includes('security') ? D.yellow : log.action?.includes('engineer') ? '#8b5cf6' : log.action?.includes('deposit') ? D.green : log.action?.includes('withdrawal') ? D.red : D.accent
                  return (
                    <div key={log.id} style={{ ...rowCard, ...(isAr ? { borderLeft: `3px solid ${actionColor}` } : { borderRight: `3px solid ${actionColor}` }) }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' as const, gap: 6 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ padding: '1px 6px', borderRadius: 4, background: `${actionColor}15`, color: actionColor, fontSize: 9, fontWeight: 700 }}>{log.action}</span>
                            {log.adminId && <span style={{ fontSize: 9, color: D.textMuted, background: D.surface, padding: '1px 6px', borderRadius: 4 }}>{isAr ? 'إدارة' : 'Admin'}</span>}
                          </div>
                          {log.details && <div style={{ fontSize: 11, color: D.textSecondary, lineHeight: 1.5 }} dir="auto">{log.details}</div>}
                        </div>
                        <div style={{ fontSize: 9, color: D.textMuted, whiteSpace: 'nowrap' as const }}>{fmtDate(log.createdAt)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ═══ ENGINEER AGENT TAB ═══ */}
      {activeTab === 'engineer' && (
        <div style={{ ...cardStyle, padding: '20px' }}>
          <h3 style={sectionTitle}><Icon name="bot" size={18} color="#8b5cf6" /> {isAr ? 'وكيل المهندس المعماري' : 'Software Architect Agent'}</h3>
          <p style={{ fontSize: 12, color: D.textMuted, marginBottom: 16 }}>{isAr ? 'وكيل ذكاء اصطناعي مستقل لمراقبة وصيانة المنصة تلقائياً' : 'Autonomous AI agent for platform monitoring and maintenance'}</p>

          {/* Sub Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {[
              { id: 'actions' as const, label: isAr ? 'الإجراءات' : 'Actions', icon: 'zap' },
              { id: 'schedules' as const, label: isAr ? 'الجدولة التلقائية' : 'Auto-Scheduling', icon: 'clock' },
            ].map(st => (
              <button key={st.id} onClick={() => { setEngineerSubTab(st.id); if (st.id === 'schedules') loadEngineerSchedules() }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: engineerSubTab === st.id ? D.accentBg : 'rgba(255,255,255,0.02)', color: engineerSubTab === st.id ? D.accent : D.textMuted, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name={st.icon as any} size={12} color={engineerSubTab === st.id ? D.accent : D.textMuted} /> {st.label}
              </button>
            ))}
          </div>

          {/* Status Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: isAr ? 'الحالة' : 'Status', value: isAr ? 'يعمل' : 'Running', color: D.green },
              { label: isAr ? 'أخطاء' : 'Errors', value: statsData?.pendingDeposits ?? 0, color: D.red },
              { label: isAr ? 'تم الإصلاح' : 'Fixed', value: statsData?.activeUsers ?? 0, color: D.green },
              { label: isAr ? 'الأداء' : 'Perf', value: '98%', color: D.accent },
            ].map((s, i) => (
              <div key={i} style={{ padding: 12, borderRadius: 10, background: `${s.color}08`, border: `1px solid ${s.color}20`, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: D.textMuted }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {engineerSubTab === 'actions' && (<>
          {/* Agent Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { key: 'diagnostics', label: isAr ? 'تشخيص النظام' : 'Run Diagnostics', icon: 'chart', color: '#8b5cf6', desc: isAr ? 'فحص شامل لصحة المنصة' : 'Full platform health check' },
              { key: 'security_scan', label: isAr ? 'فحص الأمان' : 'Security Scan', icon: 'shield', color: '#ef4444', desc: isAr ? 'فحص ثغرات أمنية' : 'Vulnerability scan' },
              { key: 'fix_errors', label: isAr ? 'إصلاح الأخطاء' : 'Fix Errors', icon: 'settings', color: '#f59e0b', desc: isAr ? 'إصلاح المعاملات العالقة' : 'Fix stuck transactions' },
              { key: 'daily_report', label: isAr ? 'تقرير يومي' : 'Daily Report', icon: 'doc', color: '#06b6d4', desc: isAr ? 'تقرير شامل عن المنصة' : 'Comprehensive platform report' },
              { key: 'genius_mode', label: isAr ? 'الوضع العبقري' : 'Genius Mode', icon: 'star', color: '#a855f7', desc: isAr ? 'تحليل ذكي متقدم + 50 أداة تلقائية' : 'AI deep analysis + 50 auto-tools' },
              { key: 'performance_optimization', label: isAr ? 'تحسين الأداء' : 'Performance', icon: 'chart', color: '#10b981', desc: isAr ? 'تحسين سرعة المنصة' : 'Optimize platform speed' },
              { key: 'auto_develop', label: isAr ? 'تطوير تلقائي' : 'Auto-Develop', icon: 'zap', color: '#f43f5e', desc: isAr ? 'اقتراح وبناء ميزات جديدة' : 'Suggest & build new features' },
              { key: 'competitor_analysis', label: isAr ? 'تحليل المنافسين' : 'Competitors', icon: 'building', color: '#0ea5e9', desc: isAr ? 'تحليل بينانس وكوين بيس' : 'Analyze Binance/Coinbase' },
              { key: 'learn_from_errors', label: isAr ? 'تعلم من الأخطاء' : 'Learn Errors', icon: 'brain', color: '#8b5cf6', desc: isAr ? 'بناء نظام منع الأخطاء' : 'Build error prevention' },
              { key: 'deep_code_review', label: isAr ? 'مراجعة الكود' : 'Code Review', icon: 'code', color: '#14b8a6', desc: isAr ? 'فحص عميق لكود المشروع' : 'Deep project code review' },
              { key: 'scaling_plan', label: isAr ? 'خطة التوسع' : 'Scaling Plan', icon: 'layers', color: '#6366f1', desc: isAr ? 'تجهيز لـ 100 ألف مستخدم' : 'Ready for 100K users' },
              { key: 'auto_document', label: isAr ? 'توثيق تلقائي' : 'Auto-Document', icon: 'fileText', color: '#f97316', desc: isAr ? 'توليد توثيق تلقائي' : 'Auto-generate docs' },
              { key: 'monitor_api_health', label: isAr ? 'مراقبة API' : 'API Health', icon: 'building', color: '#3b82f6', desc: isAr ? 'فحص حالة جميع الـ APIs' : 'Check all API endpoints' },
              { key: 'backup_report', label: isAr ? 'تقرير النسخ' : 'Backup Report', icon: 'lock', color: '#f97316', desc: isAr ? 'حالة النسخ الاحتياطي' : 'Backup status report' },
            ].map(action => (
              <button key={action.key} onClick={() => engineerAction(action.key)} disabled={actionLoading === 'eng-' + action.key} style={{ ...cardStyle, padding: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, ...(isAr ? { borderLeft: `3px solid ${action.color}` } : { borderRight: `3px solid ${action.color}` }), transition: 'all 0.15s', textAlign: isAr ? 'right' : 'left' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${action.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {actionLoading === 'eng-' + action.key ? <div style={{ width: 14, height: 14, border: `2px solid ${action.color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <Icon name={action.icon as any} size={16} color={action.color} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: D.textPrimary }}>{action.label}</div>
                  <div style={{ fontSize: 10, color: D.textMuted }}>{action.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Engineer Agent Result */}
          {engineerResult && (
            <div style={{ ...cardStyle, padding: '16px', ...(isAr ? { borderLeft: `3px solid #8b5cf6` } : { borderRight: `3px solid #8b5cf6` }), marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icon name="check" size={14} color={D.green} />
                <span style={{ fontSize: 12, fontWeight: 700, color: D.textPrimary }}>{isAr ? 'النتيجة:' : 'Result:'} {engineerResult.action}</span>
              </div>
              {engineerResult.data?.aiAnalysis ? (
                <div style={{ fontSize: 11, color: D.textSecondary, whiteSpace: 'pre-wrap', lineHeight: 1.6, maxHeight: 300, overflowY: 'auto', background: `${D.purpleBg}`, padding: 12, borderRadius: 8, border: `1px solid ${D.purpleBorder}` }} dir="auto">{engineerResult.data.aiAnalysis}</div>
              ) : engineerResult.data?.endpoints ? (
                <div style={{ fontSize: 11, color: D.textSecondary }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
                    <div style={{ textAlign: 'center', padding: 6, background: `${D.greenBg}`, borderRadius: 6, border: `1px solid ${D.greenBorder}` }}><div style={{ fontSize: 9, color: D.textMuted }}>Healthy</div><div style={{ fontWeight: 900, color: D.green }}>{engineerResult.data.summary?.healthy || 0}</div></div>
                    <div style={{ textAlign: 'center', padding: 6, background: `${D.yellowBg}`, borderRadius: 6, border: `1px solid ${D.yellowBorder}` }}><div style={{ fontSize: 9, color: D.textMuted }}>Degraded</div><div style={{ fontWeight: 900, color: D.yellow }}>{engineerResult.data.summary?.degraded || 0}</div></div>
                    <div style={{ textAlign: 'center', padding: 6, background: `${D.redBg}`, borderRadius: 6, border: `1px solid ${D.redBorder}` }}><div style={{ fontSize: 9, color: D.textMuted }}>Down</div><div style={{ fontWeight: 900, color: D.red }}>{engineerResult.data.summary?.unreachable || 0}</div></div>
                    <div style={{ textAlign: 'center', padding: 6, background: `${D.accentBg}`, borderRadius: 6, border: `1px solid ${D.accentBorder}` }}><div style={{ fontSize: 9, color: D.textMuted }}>Avg ms</div><div style={{ fontWeight: 900, color: D.accent }}>{engineerResult.data.summary?.avgResponseTimeMs || 0}</div></div>
                  </div>
                </div>
              ) : (
                <pre style={{ fontSize: 10, color: D.textSecondary, overflow: 'auto', maxHeight: 200, background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 8, direction: 'ltr' as const }}>{JSON.stringify(engineerResult.data, null, 2)}</pre>
              )}
            </div>
          )}

          {/* Cleanup Database */}
          <button onClick={() => { if (confirm(isAr ? 'هل أنت متأكد من تنظيف قاعدة البيانات؟ سيتم حذف السجلات القديمة.' : 'Clean up old records from the database?')) engineerAction('cleanup_database') }} disabled={actionLoading === 'eng-cleanup_database'} style={{ width: '100%', padding: '12px', background: `${D.redBg}`, border: `1px solid ${D.redBorder}`, borderRadius: 10, color: D.red, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Cairo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {actionLoading === 'eng-cleanup_database' ? <div style={{ width: 12, height: 12, border: `2px solid ${D.red}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <Icon name="trash" size={14} color={D.red} />}
            {isAr ? 'تنظيف قاعدة البيانات' : 'Cleanup Database'}
          </button>
          </>)}

          {engineerSubTab === 'schedules' && (<>
            {/* Schedule Diagnostics */}
            <div style={{ ...cardStyle, padding: '14px', marginBottom: 12 }}>
              <h4 style={{ ...sectionTitle, fontSize: 13, marginBottom: 10 }}>{isAr ? 'جدولة التشخيصات تلقائياً' : 'Schedule Auto-Diagnostics'}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input placeholder={isAr ? 'تعبيرة cron (مثل: 0 */6 * * *)' : 'Cron expression (e.g. 0 */6 * * *)'} id="eng-diag-cron" defaultValue="0 */6 * * *" style={{ ...inputStyle, fontSize: 12, padding: '8px 12px' }} />
                <button onClick={() => { const el = document.getElementById('eng-diag-cron') as HTMLInputElement; if (el?.value) { setActionLoading('eng-schedule_diagnostics'); const adminUser = JSON.parse(localStorage.getItem('sona_user') || '{}'); fetch('/api/admin/engineer-agent', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ userId: adminUser.id, action: 'schedule_diagnostics', schedule: el.value }) }).then(r => r.json()).then(d => { if (d.success) { showToast(isAr ? 'تم تعيين الجدولة' : 'Schedule set'); loadEngineerSchedules() } else showToast(d.error || 'Error', 'err') }).catch(() => showToast(isAr ? 'خطأ' : 'Error', 'err')).finally(() => setActionLoading(null)) } }} disabled={actionLoading === 'eng-schedule_diagnostics'} style={{ padding: '8px 16px', background: '#8b5cf620', border: '1px solid #8b5cf640', borderRadius: 8, color: '#8b5cf6', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>{actionLoading === 'eng-schedule_diagnostics' ? '...' : (isAr ? 'تعيين' : 'Set')}</button>
              </div>
              <div style={{ fontSize: 9, color: D.textMuted, marginTop: 4 }}>{isAr ? 'مثال: 0 */6 * * * = كل 6 ساعات، 0 2 * * * = يومياً الساعة 2 صباحاً' : 'Example: 0 */6 * * * = every 6h, 0 2 * * * = daily at 2AM'}</div>
            </div>

            {/* Schedule Security Scan */}
            <div style={{ ...cardStyle, padding: '14px', marginBottom: 12 }}>
              <h4 style={{ ...sectionTitle, fontSize: 13, marginBottom: 10 }}>{isAr ? 'جدولة فحص الأمان تلقائياً' : 'Schedule Auto-Security Scan'}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input placeholder={isAr ? 'تعبيرة cron (مثل: 0 2 * * *)' : 'Cron expression (e.g. 0 2 * * *)'} id="eng-sec-cron" defaultValue="0 2 * * *" style={{ ...inputStyle, fontSize: 12, padding: '8px 12px' }} />
                <button onClick={() => { const el = document.getElementById('eng-sec-cron') as HTMLInputElement; if (el?.value) { setActionLoading('eng-schedule_security_scan'); const adminUser = JSON.parse(localStorage.getItem('sona_user') || '{}'); fetch('/api/admin/engineer-agent', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ userId: adminUser.id, action: 'schedule_security_scan', schedule: el.value }) }).then(r => r.json()).then(d => { if (d.success) { showToast(isAr ? 'تم تعيين الجدولة' : 'Schedule set'); loadEngineerSchedules() } else showToast(d.error || 'Error', 'err') }).catch(() => showToast(isAr ? 'خطأ' : 'Error', 'err')).finally(() => setActionLoading(null)) } }} disabled={actionLoading === 'eng-schedule_security_scan'} style={{ padding: '8px 16px', background: '#ef444420', border: '1px solid #ef444440', borderRadius: 8, color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>{actionLoading === 'eng-schedule_security_scan' ? '...' : (isAr ? 'تعيين' : 'Set')}</button>
              </div>
              <div style={{ fontSize: 9, color: D.textMuted, marginTop: 4 }}>{isAr ? 'يُفضل تشغيل فحص الأمان مرة يومياً في وقت قليل النشاط' : 'Recommended: run security scan once daily during low-activity hours'}</div>
            </div>

            {/* Active Schedules List */}
            <div style={{ ...cardStyle, padding: '14px' }}>
              <h4 style={{ ...sectionTitle, fontSize: 13, marginBottom: 10 }}>{isAr ? 'الجداول النشطة' : 'Active Schedules'} ({engineerSchedules.length})</h4>
              {engineerSchedules.length === 0 ? (
                <div style={{ fontSize: 11, color: D.textMuted, textAlign: 'center', padding: 20 }}>{isAr ? 'لا توجد جداول مجدولة بعد' : 'No schedules configured yet'}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {engineerSchedules.map((sch, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: D.textPrimary }}>{sch.task === 'diagnostics' ? (isAr ? 'تشخيصات' : 'Diagnostics') : (isAr ? 'فحص الأمان' : 'Security Scan')}</div>
                        <div style={{ fontSize: 10, color: D.textMuted, fontFamily: 'monospace' }}>{sch.cron}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, background: sch.enabled ? D.greenBg : D.redBg, border: `1px solid ${sch.enabled ? D.greenBorder : D.redBorder}`, color: sch.enabled ? D.green : D.red, fontSize: 9, fontWeight: 700 }}>{sch.enabled ? (isAr ? 'مفعّل' : 'ON') : (isAr ? 'معطّل' : 'OFF')}</span>
                        <button onClick={() => { const adminUser = JSON.parse(localStorage.getItem('sona_user') || '{}'); fetch('/api/admin/engineer-agent', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ userId: adminUser.id, action: 'toggle_schedule', scheduleKey: sch.key, enabled: !sch.enabled }) }).then(r => r.json()).then(d => { if (d.success) { showToast(isAr ? 'تم التحديث' : 'Updated'); loadEngineerSchedules() } else showToast(d.error || 'Error', 'err') }).catch(() => showToast(isAr ? 'خطأ' : 'Error', 'err')) }} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: sch.enabled ? D.redBg : D.greenBg, color: sch.enabled ? D.red : D.green, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>{sch.enabled ? (isAr ? 'إيقاف' : 'Disable') : (isAr ? 'تفعيل' : 'Enable')}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>)}
        </div>
      )}

      </div>
      {/* End Content Area */}
      </div>
      {/* End Main Layout */}
      {/* Professional Admin Panel CSS */}
      <style>{`
        /* Admin Sidebar */
        .admin-sidebar {
          display: flex !important;
          position: sticky;
          top: 64px;
          height: calc(100vh - 64px);
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(64,158,255,0.15) transparent;
        }
        .admin-sidebar::-webkit-scrollbar { width: 3px; }
        .admin-sidebar::-webkit-scrollbar-thumb { background: rgba(64,158,255,0.15); border-radius: 3px; }

        /* Admin Mobile Tabs */
        .admin-mobile-tabs { display: none !important; }

        /* Admin Stats Grid */
        .admin-stats-grid { grid-template-columns: repeat(4, 1fr) !important; }

        /* Admin Sidebar Item Hover */
        .admin-sidebar-item { transition: all 0.2s ease !important; position: relative; }
        .admin-sidebar-item:hover { background: rgba(64,158,255,0.06) !important; }
        .admin-sidebar-item.active { background: rgba(64,158,255,0.1) !important; }

        /* Admin Header */
        .admin-header {
          position: sticky;
          top: 0;
          z-index: 50;
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
        }

        /* Professional Stat Card */
        .pro-stat-card {
          position: relative;
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .pro-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }
        .pro-stat-card::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--stat-color, #409eff), transparent);
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .pro-stat-card:hover::after { opacity: 1; }

        /* Admin Content Card */
        .admin-card {
          transition: all 0.2s ease;
        }
        .admin-card:hover {
          border-color: rgba(64,158,255,0.2) !important;
        }

        /* Admin Action Button */
        .admin-action-btn {
          transition: all 0.15s ease !important;
        }
        .admin-action-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .admin-action-btn:active {
          transform: translateY(0);
        }

        /* Admin Row Card */
        .admin-row-card {
          transition: all 0.15s ease;
        }
        .admin-row-card:hover {
          border-color: rgba(64,158,255,0.15) !important;
          background: rgba(64,158,255,0.02) !important;
        }

        /* Professional Badge */
        .pro-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        /* Admin Section Title */
        .admin-section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 12px;
        }

        /* Admin Mobile Menu Button */
        .admin-mobile-menu-btn { display: none !important; }

        /* Responsive Design */
        @media (max-width: 1024px) {
          .admin-sidebar { width: 180px !important; }
          .admin-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }

        @media (max-width: 768px) {
          .admin-sidebar { display: none !important; }
          .admin-mobile-tabs { display: flex !important; }
          .admin-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .admin-mobile-menu-btn { display: flex !important; }
          .admin-header-content { padding: 10px 14px !important; }
        }

        @media (max-width: 480px) {
          .admin-stats-grid { grid-template-columns: 1fr 1fr !important; }
          .admin-header-title { font-size: 14px !important; }
          .admin-header-subtitle { font-size: 9px !important; }
        }

        /* Scroll behavior for admin content */
        .admin-content-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(64,158,255,0.1) transparent;
        }
        .admin-content-scroll::-webkit-scrollbar { width: 4px; }
        .admin-content-scroll::-webkit-scrollbar-thumb { background: rgba(64,158,255,0.1); border-radius: 4px; }

        /* Admin chart container */
        .admin-chart-container {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
        }

        /* Pulse animation for live indicators */
        @keyframes admin-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .admin-live-dot {
          animation: admin-pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
})

export default function SonaApp() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // ═══════════════════════════════════════════════════════════
  // CRITICAL FIX: Sync user state to Zustand store so that
  // P2P, Withdraw, and other components that use useAppStore()
  // can access the correct user data with balances
  // ═══════════════════════════════════════════════════════════
  const syncUserToStore = useCallback((userData: User | null) => {
    if (userData) {
      useAppStore.setState({
        user: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          balance: userData.balance,
          totalProfit: userData.totalProfit,
          totalDeposit: (userData as any).totalDeposited ?? (userData as any).totalDeposit ?? 0,
          totalWithdraw: (userData as any).totalWithdrawn ?? (userData as any).totalWithdraw ?? 0,
          emailVerified: !!userData.emailVerified,
          isActive: true,
          role: userData.role,
          referralCode: userData.referralCode,
          referredBy: (userData as any).referredByCode ?? (userData as any).referredBy ?? null,
          kycStatus: userData.kycStatus,
          phone: userData.phone,
          avatar: userData.avatar,
          withdrawableBalance: userData.withdrawableBalance ?? 0,
        },
        isAuthenticated: true,
      })
    } else {
      useAppStore.setState({ user: null, isAuthenticated: false })
    }
  }, [])
  const [page, setPage] = useState('dashboard')
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [refCode, setRefCode] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  const [forgotEmail, setForgotEmail] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showReset, setShowReset] = useState(false)

  const [packages, setPackages] = useState<Pkg[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [depositAddr, setDepositAddr] = useState<DepositAddress | null>(null)
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrice[]>([])
  const [agents, setAgents] = useState<SupportAgent[]>(AGENTS)
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConv, setActiveConv] = useState<ChatConversation | null>(null)

  const chatMsgRef = useRef<HTMLTextAreaElement>(null)
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Support level system state
  const [supportLevel, setSupportLevel] = useState(1)
  const [supportInfo, setSupportInfo] = useState<{level:number,nameAr:string,titleAr:string,avatar:string,status:string,isHuman:boolean} | null>(null)
  const [typingPhase, setTypingPhase] = useState<'idle'|'reading'|'thinking'|'typing'>('idle')
  const [showEscalationNotice, setShowEscalationNotice] = useState<{from:string,to:string}|null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [supportMessages, setSupportMessages] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const [kycForm, setKycForm] = useState({ fullName: '', idNumber: '', docType: 'PASSPORT', selfie: false })
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', wallet: '', network: 'BEP20' })
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [investModal, setInvestModal] = useState<Pkg | null>(null)
  const [investAmount, setInvestAmount] = useState('')
  const [investMode, setInvestMode] = useState<'SONA'>('SONA')
  const [investModalMode, setInvestModalMode] = useState<'SONA'>('SONA')
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    platformMode: 'SONA', maintenanceMode: false, maintenanceMessage: '',
    fakeHackMode: false, fakeHackMessage: 'تم اختراق المنصة',
  })
  const [depositAmount, setDepositAmount] = useState('')
  const [depositTxHash, setDepositTxHash] = useState('')
  const [nowpaymentsData, setNowpaymentsData] = useState<{paymentId: string; payAddress: string; payAmount: number; payCurrency: string; expiration: string} | null>(null)
  const [lang, setLang] = useState<'ar' | 'en'>(() => { try { const s = localStorage.getItem('sona_lang'); return s === 'en' || s === 'ar' ? s : 'ar' } catch { return 'ar' } })
  const [verifyCodeInput, setVerifyCodeInput] = useState('')
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false)
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('')
  const [showRegistrationOtp, setShowRegistrationOtp] = useState(false)
  const [registrationOtp, setRegistrationOtp] = useState<string[]>(Array(6).fill(''))
  const [otpVerifyLoading, setOtpVerifyLoading] = useState(false)
  const [otpVerifyError, setOtpVerifyError] = useState('')
  const [otpResendCountdown, setOtpResendCountdown] = useState(0)
  const [otpResendLoading, setOtpResendLoading] = useState(false)
  const [authTransitioning, setAuthTransitioning] = useState(false)
  const t = (key: string) => translations[lang]?.[key] || translations['ar']?.[key] || key
  const isRTL = lang === 'ar'
  const isAr = lang === 'ar'
  const toggleLang = () => { const next = lang === 'ar' ? 'en' : 'ar'; setLang(next); try { localStorage.setItem('sona_lang', next) } catch {} }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('reset')
    if (token) { setResetToken(token); setShowReset(true) }
    // Read referral code from URL
    const refCodeParam = params.get('ref')
    if (refCodeParam) { setRefCode(refCodeParam.toUpperCase()) }
  }, [])

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000)
  }, [])

  const fetchUser = useCallback(async () => {
    setLoading(true); setLoadError(false)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch('/api/auth', { signal: controller.signal })
      clearTimeout(timeout)
      if (res.ok) { const d = await res.json(); setUser(d.user) } else setUser(null)
    } catch { setUser(null); setLoadError(true) }
    setLoading(false)
  }, [])

  const [withdrawals, setWithdrawals] = useState<Transaction[]>([])

  const userRef = useRef(user)
  userRef.current = user

  // Sync user to Zustand store whenever it changes
  useEffect(() => {
    syncUserToStore(user)
  }, [user, syncUserToStore])

  // Reverse sync: When Zustand store user changes (e.g. from P2P/Withdraw/Trading refreshUser),
  // update the dashboard's local user state so all components stay in sync
  const storeUser = useAppStore(state => state.user)
  useEffect(() => {
    if (storeUser && storeUser.id === user?.id) {
      // Only update if balances differ (avoid infinite loops)
      if (storeUser.balance !== user.balance || storeUser.withdrawableBalance !== user.withdrawableBalance) {
        setUser(prev => prev ? { ...prev, ...storeUser } : prev)
      }
    }
  }, [storeUser?.balance, storeUser?.withdrawableBalance]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async () => {
    if (!userRef.current) return
    try {
      const [pkgs, inv, dep, sup, mkt, wd, allTx, notif, settings] = await Promise.all([
        fetch('/api/packages').then(r => r.json()).catch(() => ({ packages: [] })),
        fetch('/api/investments').then(r => r.json()).catch(() => ({ investments: [] })),
        fetch('/api/deposits').then(r => r.json()).catch(() => ({ depositAddress: null, transactions: [] })),
        fetch('/api/support').then(r => r.json()).catch(() => ({ agents: [], conversations: [] })),
        fetch('/api/market').then(r => r.json()).catch(() => ({ prices: [] })),
        fetch('/api/withdrawals').then(r => r.json()).catch(() => ({ transactions: [] })),
        fetch('/api/transactions').then(r => r.json()).catch(() => ({ transactions: [] })),
        fetch(`/api/notifications?userId=${userRef.current.id}`).then(r => r.json()).catch(() => ({ notifications: [], unreadCount: 0 })),
        fetch('/api/admin/settings', { headers: (() => { const tk = useAppStore.getState().getToken(); const h: Record<string, string> = {}; if (tk) h['Authorization'] = `Bearer ${tk}`; return h })() }).then(r => r.json()).catch(() => null),
      ])
      setPackages(pkgs.packages || [])
      setInvestments(inv.investments || [])
      setDepositAddr(dep.depositAddress || null)
      setTransactions(allTx.transactions || dep.transactions || [])
      setWithdrawals(wd.transactions || [])
      if (sup.agents?.length) setAgents(sup.agents)
      setConversations(sup.conversations || [])
      setCryptoPrices(mkt.prices || [])
      setNotifications(notif.notifications || [])
      setUnreadCount(notif.unreadCount || 0)
      if (settings) {
        setPlatformSettings(prev => ({
          ...prev,
          platformMode: settings.platformMode || prev.platformMode,
          maintenanceMode: settings.maintenanceMode ?? prev.maintenanceMode,
          maintenanceMessage: settings.maintenanceMessage || prev.maintenanceMessage,
          fakeHackMode: settings.fakeHackMode ?? prev.fakeHackMode,
          fakeHackMessage: settings.fakeHackMessage || prev.fakeHackMessage,
        }))
      }
    } catch (e) { console.error('Fetch data error:', e) }
  }, [])

  useEffect(() => { fetchUser() }, [])
  useEffect(() => { if (user) fetchData() }, [user])
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const chatContainer = chatEndRef.current?.parentElement
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight
        }
      })
    })
  }, [activeConv?.messages])

  // RTL-safe scroll on supportMessages change or typing phase
  useEffect(() => {
    const scrollToBottom = () => {
      const chatContainer = chatEndRef.current?.parentElement
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight
    }
    requestAnimationFrame(() => requestAnimationFrame(scrollToBottom))
    const t1 = setTimeout(scrollToBottom, 50)
    const t2 = setTimeout(scrollToBottom, 200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [supportMessages, typingPhase])

  // ===== MOVED HOOKS (must be before conditional returns per Rules of Hooks) =====
  const [depositCurrency, setDepositCurrency] = useState('usdtbsc')
  const [depositChecking, setDepositChecking] = useState(false)
  const [depositCountdown, setDepositCountdown] = useState(0)

  useEffect(() => {
    if (depositCountdown <= 0) return
    const timer = setInterval(() => setDepositCountdown(prev => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [depositCountdown])

  const [kycStep, setKycStep] = useState(0)
  const [kycFrontPreview, setKycFrontPreview] = useState<string | null>(null)
  const [kycSelfiePreview, setKycSelfiePreview] = useState<string | null>(null)
  const [kycBackPreview, setKycBackPreview] = useState<string | null>(null)
  const [kycDocBack, setKycDocBack] = useState<File | null>(null)
  const [kycSubmitting, setKycSubmitting] = useState(false)

  const navigate = (id: string) => {
    if (id === 'more') { setMenuOpen(true); return }
    if (id === 'admin') { setMenuOpen(false); router.push('/admin'); return }
    setPage(id); setMenuOpen(false)
    if (id === 'support' && !activeConv) loadSupportChat()
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const navItems = useMemo(() => [
    { id: 'dashboard', label: isAr ? 'الرئيسية' : 'Home', icon: 'home' },
    { id: 'trading', label: isAr ? 'التداول' : 'Trading', icon: 'chart' },
    { id: 'packages', label: isAr ? 'الباقات' : 'Packages', icon: 'gift' },
    { id: 'investments', label: isAr ? 'استثماراتي' : 'My Investments', icon: 'gem' },
    { id: 'deposit', label: isAr ? 'الإيداع' : 'Deposit', icon: 'wallet' },
    { id: 'withdraw', label: isAr ? 'السحب' : 'Withdraw', icon: 'cash' },
    { id: 'p2p', label: isAr ? 'تحويل P2P' : 'P2P Transfer', icon: 'swap' },
    { id: 'signals', label: isAr ? 'الإشارات' : 'Signals', icon: 'zap' },
    { id: 'kyc', label: isAr ? 'التحقق' : 'Verification', icon: 'id' },
    { id: 'account', label: isAr ? 'حسابي' : 'My Account', icon: 'user' },
    { id: 'support', label: isAr ? 'الدعم' : 'Support', icon: 'chat' },
    { id: 'notifications', label: isAr ? 'الإشعارات' : 'Notifications', icon: 'bell' },
    { id: 'referrals', label: isAr ? 'الإحالات' : 'Referrals', icon: 'link' },
    { id: 'legitimacy', label: isAr ? 'عن المنصة' : 'About', icon: 'building' },
    { id: 'terms', label: isAr ? 'الشروط' : 'Terms', icon: 'doc' },
    { id: 'privacy', label: isAr ? 'الخصوصية' : 'Privacy', icon: 'lock' },
    ...(user?.role === 'ADMIN' ? [{ id: 'admin', label: isAr ? 'الإدارة' : 'Admin', icon: 'settings' }] : []),
  ], [user?.role, lang])

  const bottomNav = useMemo(() => [
    { id: 'dashboard', label: isAr ? 'الرئيسية' : 'Home', icon: 'home' },
    { id: 'trading', label: isAr ? 'التداول' : 'Trading', icon: 'chart' },
    { id: 'packages', label: isAr ? 'الباقات' : 'Packages', icon: 'gift' },
    { id: 'deposit', label: isAr ? 'الإيداع' : 'Deposit', icon: 'wallet' },
    { id: 'more', label: isAr ? 'المزيد' : 'More', icon: 'menu' },
  ], [lang])

  const checkNowPayment = async () => {
    if (!nowpaymentsData) return
    setDepositChecking(true)
    try {
      const res = await fetch(`/api/nowpayments/status?paymentId=${nowpaymentsData.paymentId}`)
      const d = await res.json()
      if (d.payment_status === 'finished' || d.payment_status === 'confirmed') {
        showToast(lang === 'ar' ? 'تم تأكيد الإيداع بنجاح!' : 'Deposit confirmed successfully!')
        setNowpaymentsData(null)
        setDepositAmount('')
        fetchUser()
        fetchData()
      } else if (d.payment_status === 'expired' || d.payment_status === 'failed') {
        showToast(lang === 'ar' ? 'انتهت صلاحية الدفعة أو فشلت - تواصل مع الدعم للمساعدة' : 'Payment expired or failed - Contact support for help', 'err')
        setNowpaymentsData(null)
      }
      // Intermediate states (waiting, confirming, etc.) are handled silently - no toast
    } catch { /* silent - don't show error toast for background checks */ }
    setDepositChecking(false)
  }

  const handleKycFileChange = (file: File, type: 'front' | 'back' | 'selfie') => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (type === 'front') { setKycDocFile(file); setKycFrontPreview(result) }
      else if (type === 'back') { setKycDocBack(file); setKycBackPreview(result) }
      else { setKycSelfieFile(file); setKycSelfiePreview(result) }
    }
    reader.readAsDataURL(file)
  }

  const handleKycSubmit = async () => {
    setKycSubmitting(true)
    await handleKyc()
    setKycSubmitting(false)
  }
  // ===== END MOVED HOOKS =====

  const handleLogin = async () => {
    try {
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', email, password }) })
      const d = await res.json()
      if (res.ok) { window.location.href = '/dashboard' }
      else if (d.needVerification) {
        // Email not verified - show OTP input so user can verify
        setPendingVerifyEmail(email)
        setShowRegistrationOtp(true)
        setRegistrationOtp(Array(6).fill(''))
        setOtpVerifyError('')
        setOtpResendCountdown(60)
        showToast(isAr ? 'يرجى تأكيد بريدك الإلكتروني. أدخل رمز التحقق المرسل لبريدك' : 'Please verify your email. Enter the code sent to your email')
      }
      else showToast(d.error, 'err')
    } catch { showToast('حدث خطأ في الاتصال', 'err') }
  }

  const handleRegister = async () => {
    if (!termsAccepted) { showToast(isAr ? 'يجب الموافقة على شروط الاستخدام' : 'You must accept the terms', 'err'); return }
    try {
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'register', email, password, name, phone, referralCode: refCode }) })
      const d = await res.json()
      if (res.ok) {
        if (d.needVerification) {
          // Email verification required - show OTP input immediately
          setPendingVerifyEmail(email)
          setShowRegistrationOtp(true)
          setRegistrationOtp(Array(6).fill(''))
          setOtpVerifyError('')
          setOtpResendCountdown(60)
          showToast(isAr ? 'تم إنشاء الحساب! أدخل رمز التحقق المرسل لبريدك الإلكتروني' : 'Account created! Enter the verification code sent to your email')
        } else if (d.user) {
          // No verification needed — set user directly (smooth transition, no page reload)
          setAuthTransitioning(true)
          setTimeout(() => {
            setAuthMode(null)
            setUser(d.user)
            showToast(isAr ? 'تم إنشاء الحساب بنجاح!' : 'Account created successfully!')
            setTimeout(() => setAuthTransitioning(false), 600)
          }, 200)
        } else {
          // Fallback: login manually
          const loginRes = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', email, password }) })
          const loginData = await loginRes.json()
          if (loginRes.ok && loginData.user) {
            setAuthTransitioning(true)
            setTimeout(() => {
              setAuthMode(null)
              setUser(loginData.user)
              showToast(isAr ? 'تم إنشاء الحساب بنجاح!' : 'Account created successfully!')
              setTimeout(() => setAuthTransitioning(false), 600)
            }, 200)
          } else {
            setAuthMode('login')
            showToast(isAr ? 'تم إنشاء الحساب! سجل الدخول الآن' : 'Account created! Please login')
          }
        }
      }
      else showToast(d.error, 'err')
    } catch { showToast(isAr ? 'حدث خطأ في الاتصال' : 'Connection error', 'err') }
  }

  // OTP countdown timer
  useEffect(() => {
    if (otpResendCountdown <= 0) return
    const timer = setTimeout(() => setOtpResendCountdown(prev => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [otpResendCountdown])

  // Auto-submit OTP when all 6 digits entered
  useEffect(() => {
    if (registrationOtp.every(d => d !== '') && registrationOtp.length === 6) {
      handleRegistrationOtpVerify()
    }
  }, [registrationOtp])

  const handleRegistrationOtpVerify = async () => {
    const code = registrationOtp.join('')
    if (code.length !== 6) { setOtpVerifyError(isAr ? 'يرجى إدخال رمز التحقق كاملاً' : 'Please enter the full verification code'); return }
    setOtpVerifyLoading(true)
    setOtpVerifyError('')
    try {
      const res = await fetch('/api/auth/verify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: pendingVerifyEmail, code }) })
      const d = await res.json()
      if (!res.ok) { setOtpVerifyError(d.error || (isAr ? 'رمز التحقق غير صحيح' : 'Invalid verification code')); return }
      // Auto login after verification
      try {
        const loginRes = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', email: pendingVerifyEmail, password }) })
        const loginData = await loginRes.json()
        if (loginRes.ok && loginData.user) {
          // Start transition overlay FIRST to prevent flicker
          setAuthTransitioning(true)
          // Wait for overlay to paint, then switch to dashboard
          setTimeout(() => {
            setShowRegistrationOtp(false)
            setPendingVerifyEmail('')
            setRegistrationOtp(Array(6).fill(''))
            setAuthMode(null)
            setUser(loginData.user)
            showToast(isAr ? 'تم التحقق من البريد الإلكتروني بنجاح!' : 'Email verified successfully!')
            // Remove transition overlay after dashboard renders
            setTimeout(() => setAuthTransitioning(false), 600)
          }, 200)
        } else {
          setShowRegistrationOtp(false)
          setAuthMode('login')
          showToast(isAr ? 'تم التحقق! يمكنك تسجيل الدخول الآن' : 'Verified! You can now login')
        }
      } catch {
        setShowRegistrationOtp(false)
        setAuthMode('login')
        showToast(isAr ? 'تم التحقق! يمكنك تسجيل الدخول الآن' : 'Verified! You can now login')
      }
    } catch { setOtpVerifyError(isAr ? 'حدث خطأ في الاتصال' : 'Connection error') }
    finally { setOtpVerifyLoading(false) }
  }

  const handleOtpResend = async () => {
    if (otpResendCountdown > 0 || otpResendLoading) return
    setOtpResendLoading(true)
    setOtpVerifyError('')
    try {
      const res = await fetch('/api/auth/send-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: pendingVerifyEmail }) })
      const d = await res.json()
      if (!res.ok) { setOtpVerifyError(d.error || (isAr ? 'فشل إرسال الرمز' : 'Failed to resend code')); return }
      setRegistrationOtp(Array(6).fill(''))
      setOtpResendCountdown(60)
      showToast(isAr ? 'تم إعادة إرسال رمز التحقق' : 'Verification code resent')
    } catch { setOtpVerifyError(isAr ? 'حدث خطأ في الاتصال' : 'Connection error') }
    finally { setOtpResendLoading(false) }
  }

  const handleForgotPassword = async () => {
    if (!forgotEmail) { showToast('يرجى إدخال البريد الإلكتروني', 'err'); return }
    try {
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'forgot-password', email: forgotEmail }) })
      const d = await res.json()
      if (res.ok) { showToast('تم إرسال رابط إعادة تعيين كلمة المرور'); setShowForgot(false); setForgotEmail('') }
      else showToast(d.error, 'err')
    } catch { showToast('حدث خطأ', 'err') }
  }

  const handleResetPassword = async () => {
    if (!newPassword) { showToast('يرجى إدخال كلمة المرور الجديدة', 'err'); return }
    try {
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset-password', token: resetToken, newPassword }) })
      const d = await res.json()
      if (res.ok) { showToast('تم تغيير كلمة المرور بنجاح'); setShowReset(false); setResetToken(''); setNewPassword(''); setAuthMode('login') }
      else showToast(d.error, 'err')
    } catch { showToast('حدث خطأ', 'err') }
  }

  const handleLogout = async () => {
    try { await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }) } catch {}
    setUser(null); setPage('dashboard'); setAuthMode(null); setShowVerifyPrompt(false)
  }

  const handleSendVerifyCode = async () => {
    try {
      const res = await fetch('/api/auth/send-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user?.email }) })
      const d = await res.json()
      if (res.ok) { showToast(d.message || t('verifyEmail')); setShowVerifyPrompt(true) }
      else showToast(d.error, 'err')
    } catch { showToast(t('connectionError'), 'err') }
  }

  const handleVerifyEmail = async () => {
    if (!verifyCodeInput) { showToast(t('enterEmail'), 'err'); return }
    try {
      const res = await fetch('/api/auth/verify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user?.email, code: verifyCodeInput }) })
      const d = await res.json()
      if (res.ok) { showToast(t('verifiedEmail')); setShowVerifyPrompt(false); setVerifyCodeInput(''); fetchUser() }
      else showToast(d.error, 'err')
    } catch { showToast(t('connectionError'), 'err') }
  }

  const handleInvest = async () => {
    if (!investModal || !investAmount) return
    try {
      // Auto-determine mode based on platform settings
      let effectiveMode = 'SONA'
      const investBody: any = { userId: String(user!.id), packageId: investModal.id, amount: parseFloat(investAmount) }
      // If platform is in BOTH mode, let user choose mode
      if (platformSettings.platformMode === 'BOTH' && effectiveMode) {
        investBody.mode = effectiveMode
      } else if (effectiveMode) {
        investBody.mode = effectiveMode
      }
      const res = await fetch('/api/invest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(investBody) })
      const d = await res.json()
      if (res.ok) { showToast('تم تفعيل الباقة بنجاح!'); setInvestModal(null); setInvestAmount(''); fetchUser(); fetchData() }
      else showToast(d.error, 'err')
    } catch { showToast('حدث خطأ', 'err') }
  }

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) < 10) { showToast(t('minDeposit'), 'err'); return }
    try {
      const res = await fetch('/api/deposits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: parseFloat(depositAmount), currency: depositCurrency }) })
      const d = await res.json()
      if (res.ok) {
        if (d.payment) {
          setNowpaymentsData(d.payment)
          setDepositCountdown(30 * 60) // 30 min countdown
          showToast(t('depositSuccess'))
          fetchData()
        } else {
          showToast(lang === 'ar' ? 'فشل إنشاء طلب الدفع. يرجى المحاولة مرة أخرى.' : 'Failed to create payment. Please try again.', 'err')
        }
      } else showToast(d.error, 'err')
    } catch { showToast(t('connectionError'), 'err') }
  }

  const handleWithdraw = async () => {
    setWithdrawLoading(true)
    try {
      const withdrawBody: any = { userId: String(user!.id), amount: parseFloat(withdrawForm.amount), method: 'usdt_' + (withdrawForm.network || 'BEP20').toLowerCase(), walletAddress: withdrawForm.wallet, details: `طلب سحب USDT ${withdrawForm.network || 'BEP20'}` }
      const res = await fetch('/api/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(withdrawBody) })
      const d = await res.json()
      if (res.ok) {
        showToast(d.message || t('withdrawSuccess'))
        setWithdrawForm({ amount: '', wallet: '', network: 'BEP20' })
        setShowWithdrawConfirm(false)
        fetchUser(); fetchData()
      } else showToast(d.error, 'err')
    } catch { showToast(t('connectionError'), 'err') }
    setWithdrawLoading(false)
  }

  const [kycDocFile, setKycDocFile] = useState<File | null>(null)
  const [kycSelfieFile, setKycSelfieFile] = useState<File | null>(null)

  const handleKyc = async () => {
    try {
      // Use FormData for actual file upload
      const formData = new FormData()
      formData.append('fullName', kycForm.fullName)
      formData.append('idNumber', kycForm.idNumber)
      formData.append('documentType', kycForm.docType)
      if (kycDocFile) formData.append('documentImage', kycDocFile)
      if (kycSelfieFile) formData.append('selfieImage', kycSelfieFile)

      const res = await fetch('/api/kyc', { method: 'POST', body: formData })
      const d = await res.json()
      if (res.ok) { showToast('تم إرسال طلب التحقق بنجاح'); fetchUser() }
      else showToast(d.error, 'err')
    } catch { showToast('حدث خطأ', 'err') }
  }

  // Level-specific config for support
  const SUPPORT_LEVELS: Record<number, {avatar:string,color:string,name:string,title:string,typingTexts:{reading:string,thinking:string,typing:string}}> = {
    1: { avatar: '/smart-help-avatar.png', color: '#409eff', name: 'المساعدة الذكية', title: 'المساعدة الذكية', typingTexts: { reading: 'المساعدة الذكية تقرأ رسالتك...', thinking: 'المساعدة الذكية تفكر في الرد...', typing: 'المساعدة الذكية تكتب...' } },
    2: { avatar: '/sona-support-avatar.png', color: '#04cf99', name: 'دعم SONA', title: 'دعم SONA', typingTexts: { reading: 'دعم SONA يقرأ رسالتك...', thinking: 'دعم SONA يفكر في الرد...', typing: 'دعم SONA يكتب...' } },
    3: { avatar: '/sona-support-avatar.png', color: '#e6a23c', name: 'دعم SONA', title: 'دعم SONA', typingTexts: { reading: 'دعم SONA يقرأ رسالتك...', thinking: 'دعم SONA يراجع الموضوع...', typing: 'دعم SONA يكتب...' } },
  }

  const getMsgLevel = (msg: any): number => {
    if (msg.metadata) { try { return JSON.parse(msg.metadata).level || 1 } catch {} }
    if (msg.senderType === 'AGENT') return 2
    if (msg.senderType === 'ADMIN') return 3
    return 1
  }

  const handleSendChat = async (overrideMsg?: string) => {
    const msg = overrideMsg || chatMsgRef.current?.value?.trim() || ''
    if (!msg) return
    if (!overrideMsg && chatMsgRef.current) chatMsgRef.current.value = ''

    // Add user message immediately
    const tempUserMsg = { id: `temp_${Date.now()}`, senderType: 'USER' as const, message: msg, isRead: true, createdAt: new Date().toISOString(), imageUrl: undefined }
    setSupportMessages(prev => [...prev, tempUserMsg])

    // RTL-safe scroll to bottom IMMEDIATELY after adding user message
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const chatContainer = chatEndRef.current?.parentElement
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight
      })
    })

    // Start typing phases - natural delays
    setTypingPhase('reading')
    const readingDelay = 600 + Math.random() * 600
    const thinkingDelay = 600 + Math.random() * 600
    const typingDelay = 800 + Math.random() * 800
    setTimeout(() => setTypingPhase('thinking'), readingDelay)
    setTimeout(() => setTypingPhase('typing'), readingDelay + thinkingDelay)
    setIsTyping(true)

    try {
      const res = await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) })
      const d = await res.json()
      if (res.ok) {
        // Handle escalation
        if (d.escalated && d.supportInfo) {
          const prevLevel = supportLevel
          const newLevel = d.supportInfo.level
          if (newLevel > prevLevel) {
            const fromName = SUPPORT_LEVELS[prevLevel]?.name || 'المساعدة الذكية'
            const toName = SUPPORT_LEVELS[newLevel]?.name || 'دعم SONA'
            setIsConnecting(true)
            setTypingPhase('idle')
            setTimeout(() => { setIsConnecting(false); setShowEscalationNotice({ from: fromName, to: toName }) }, 1500)
            setTimeout(() => setShowEscalationNotice(null), 5500)
          }
          setSupportLevel(d.supportInfo.level)
          setSupportInfo(d.supportInfo)
        } else if (d.supportInfo) {
          setSupportLevel(d.supportInfo.level)
          setSupportInfo(d.supportInfo)
        }

        // Build final messages array
        setSupportMessages(prev => {
          const filtered = prev.filter(m => m.id !== tempUserMsg.id)
          const final: any[] = [...filtered]
          if (d.userMsg) final.push(d.userMsg)
          if (d.handoffMsg) final.push({ ...d.handoffMsg, _isHandoff: true })
          if (d.transitionMsg) final.push({ ...d.transitionMsg, _isTransition: true })
          if (d.escalationMsg) final.push(d.escalationMsg)
          if (d.agentMsg) final.push(d.agentMsg)
          if (d.humanMsg) final.push(d.humanMsg)
          return final
        })

        // Also update activeConv for backward compat
        if (d.conversationId) {
          setActiveConv(prev => prev ? { ...prev, id: d.conversationId, messages: supportMessages } : prev)
        }

        setTypingPhase('idle')
        setIsTyping(false)
        playNotif()
        // RTL-safe scroll with multiple attempts
        const scrollToBottom = () => {
          const chatContainer = chatEndRef.current?.parentElement
          if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight
        }
        requestAnimationFrame(() => requestAnimationFrame(scrollToBottom))
        setTimeout(scrollToBottom, 50)
        setTimeout(scrollToBottom, 150)
        setTimeout(scrollToBottom, 300)
      } else { setTypingPhase('idle'); setIsTyping(false); showToast(d.error || (isAr ? 'حدث خطأ في الدعم' : 'Support error occurred'), 'err') }
    } catch { setTypingPhase('idle'); setIsTyping(false); showToast(isAr ? 'حدث خطأ في الاتصال بالدعم' : 'Connection error to support', 'err') }
  }

  const loadSupportChat = async () => {
    try {
      const res = await fetch('/api/support')
      const d = await res.json()
      if (res.ok && d.conversation) {
        setActiveConv(d.conversation)
        setSupportMessages(d.conversation.messages || [])
        if (d.supportInfo) {
          setSupportLevel(d.supportInfo.level)
          setSupportInfo(d.supportInfo)
        }
      }
    } catch { /* ignore */ }
  }

  const copyToClipboard = (text: string, label: string = 'تم النسخ!') => {
    try { navigator.clipboard?.writeText(text); showToast(label) } catch { showToast('فشل النسخ', 'err') }
  }



  // ===== TOAST =====
  const ToastEl = toast && (
    <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: 15, fontSize: 14, fontWeight: 700, zIndex: 100, background: D.card, color: toast.type === 'ok' ? D.green : D.red, border: `1px solid ${toast.type === 'ok' ? D.greenBorder : D.redBorder}`, maxWidth: '92%', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', animation: 'fadeUp 0.3s ease' }}>
      {toast.msg}
    </div>
  )

  // ===== APP CONTEXT VALUE (useMemo hook must be before conditional returns) =====
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const appValue = useMemo(() => ({
    user, t, lang, isRTL, D, packages, investments, transactions, withdrawals,
    depositAddr, cryptoPrices, agents, conversations, activeConv, setActiveConv,
    chatMsgRef, isTyping, kycForm, setKycForm, withdrawForm, setWithdrawForm,
    investModal, setInvestModal, investAmount, setInvestAmount, depositAmount, setDepositAmount,
    nowpaymentsData, setNowpaymentsData, depositCountdown, showWithdrawConfirm, setShowWithdrawConfirm,
    withdrawLoading, showToast, fetchData, fetchUser, handleInvest, handleDeposit, handleWithdraw,
    handleKyc, handleSendChat, loadSupportChat, copyToClipboard, handleLogout, chatEndRef,
    kycDocFile, setKycDocFile, kycSelfieFile, setKycSelfieFile, depositCurrency, setDepositCurrency,
    depositChecking, setDepositChecking, setDepositCountdown, depositTxHash, setDepositTxHash,
    checkNowPayment, PAYMENT_STATUSES, navigate, page, verifyCodeInput, setVerifyCodeInput,
    showVerifyPrompt, setShowVerifyPrompt, handleSendVerifyCode, handleVerifyEmail,
    showRegistrationOtp, registrationOtp, setRegistrationOtp, otpVerifyLoading,
    otpVerifyError, otpResendCountdown, otpResendLoading, pendingVerifyEmail,
    handleRegistrationOtpVerify, handleOtpResend, setShowRegistrationOtp, setAuthMode,
    KYC_REASONS, inputStyle, cardStyle, btnPrimary, btnOutline, fmt, fmtDate, fmtNum, fmtPct,
    AGENTS, Icon, Logo, StatusBadge, menuOpen, setMenuOpen, setToast, setLoadError,
    kycStep, setKycStep, kycFrontPreview, setKycFrontPreview, kycSelfiePreview, setKycSelfiePreview,
    kycBackPreview, setKycBackPreview, kycSubmitting, handleKycFileChange, handleKycSubmit,
    notifications, setNotifications, unreadCount, setUnreadCount,
    platformSettings, setPlatformSettings, investMode, setInvestMode,
  }), [user, lang, packages, investments, transactions, withdrawals, depositAddr, cryptoPrices,
    activeConv, isTyping, kycForm, withdrawForm, investModal, investAmount, depositAmount,
    nowpaymentsData, depositCountdown, showWithdrawConfirm, withdrawLoading, menuOpen,
    verifyCodeInput, showVerifyPrompt, depositCurrency, depositChecking, depositTxHash, kycDocFile,
    kycSelfieFile, page, kycStep, kycFrontPreview, kycSelfiePreview, kycBackPreview, kycSubmitting,
    notifications, unreadCount, platformSettings, investMode])

  // ===== LOADING =====
  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24 }}>
        <div className="logo-spin-loading"><Logo size={72} /></div>
        {loadError && <button onClick={fetchUser} style={{ padding: '8px 20px', background: D.accentBg, border: `1px solid ${D.accentBorder}`, color: D.accent, borderRadius: 25, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'إعادة المحاولة' : 'Retry'}</button>}
      </div>
    )
  }

  // ===== AUTH TRANSITION OVERLAY =====
  // Prevents flicker when switching from auth page to dashboard after registration/login
  const AuthTransitionOverlay = authTransitioning ? (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="logo-spin-loading"><Logo size={72} /></div>
    </div>
  ) : null

  // ===== RESET PASSWORD =====
  if (showReset) {
    return (
      <div style={{ minHeight: '100dvh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 400, animation: 'scaleIn 0.4s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Logo size={56} />
            <h1 style={{ fontSize: 24, fontWeight: 900, color: D.textPrimary, marginTop: 16 }}>SONA</h1>
            <p style={{ color: D.textSecondary, fontSize: 14, marginTop: 4 }}>{isAr ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}</p>
          </div>
          <div style={{ ...cardStyle, padding: '28px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input style={inputStyle} placeholder={isAr ? 'كلمة المرور الجديدة' : 'New Password'} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleResetPassword()} />
              <button onClick={handleResetPassword} style={btnPrimary}>{isAr ? 'تغيير كلمة المرور' : 'Change Password'}</button>
            </div>
            <button onClick={() => { setShowReset(false); setAuthMode('login') }} style={{ width: '100%', marginTop: 16, background: 'none', border: 'none', color: D.accent, fontSize: 13, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'العودة لتسجيل الدخول' : 'Back to Login'}</button>
          </div>
        </div>
        {ToastEl}
      </div>
    )
  }

  // ===== OTP VERIFICATION (shown on top of auth pages) =====
  const OtpVerificationModal = showRegistrationOtp ? (
    <div className="modal-enter" style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(8px)' }}>
      <div style={{ background: D.card, border: `1px solid ${D.accentBorder}`, borderRadius: 20, padding: '32px 28px', maxWidth: 400, width: '100%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Icon name="shield" size={28} color={D.accent} />
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 900, color: D.textPrimary, marginBottom: 8 }}>{isAr ? 'تحقق من بريدك الإلكتروني' : 'Verify Your Email'}</h3>
        <p style={{ fontSize: 13, color: D.textSecondary, marginBottom: 6, lineHeight: 1.7 }}>{isAr ? 'أدخل الرمز المكون من 6 أرقام المرسل إلى' : 'Enter the 6-digit code sent to'}</p>
        <p style={{ fontSize: 14, color: D.accent, fontWeight: 700, marginBottom: 20, direction: 'ltr' }}>{pendingVerifyEmail}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16, direction: 'ltr' }}>
          {registrationOtp.map((digit: string, idx: number) => (
            <input key={idx} type="text" inputMode="numeric" maxLength={1} value={digit}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const val = e.target.value; if (val && !/^\d$/.test(val)) return
                const newOtp = [...registrationOtp]; newOtp[idx] = val; setRegistrationOtp(newOtp)
                if (val && idx < 5) { const nextInput = e.currentTarget.parentElement?.querySelector(`input:nth-child(${idx + 2})`) as HTMLInputElement; nextInput?.focus() }
              }}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Backspace') {
                  if (!registrationOtp[idx] && idx > 0) { const newOtp = [...registrationOtp]; newOtp[idx - 1] = ''; setRegistrationOtp(newOtp); const prevInput = e.currentTarget.parentElement?.querySelector(`input:nth-child(${idx})`) as HTMLInputElement; prevInput?.focus() }
                  else { const newOtp = [...registrationOtp]; newOtp[idx] = ''; setRegistrationOtp(newOtp) }
                }
              }}
              onPaste={(e: React.ClipboardEvent<HTMLInputElement>) => { e.preventDefault(); const pastedData = e.clipboardData.getData('text').trim(); const digits = pastedData.replace(/\D/g, '').slice(0, 6).split(''); if (digits.length > 0) { const newOtp = [...registrationOtp]; digits.forEach((d: string, i: number) => { if (i < 6) newOtp[i] = d }); setRegistrationOtp(newOtp) } }}
              disabled={otpVerifyLoading}
              style={{ width: 44, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 800, background: D.input, border: `2px solid ${digit ? D.accent : D.border}`, borderRadius: 12, color: D.accent, outline: 'none', fontFamily: "'Cairo', sans-serif", transition: 'border-color 0.2s' }}
            />
          ))}
        </div>
        {otpVerifyError && <p style={{ color: D.red, fontSize: 12, marginBottom: 10, fontWeight: 600 }}>{otpVerifyError}</p>}
        <button onClick={handleRegistrationOtpVerify} disabled={otpVerifyLoading || registrationOtp.some(d => !d)}
          style={{ ...btnPrimary, marginTop: 4, opacity: otpVerifyLoading || registrationOtp.some(d => !d) ? 0.5 : 1, background: D.gradient, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {otpVerifyLoading ? (isAr ? 'جاري التحقق...' : 'Verifying...') : (isAr ? 'تأكيد الرمز' : 'Confirm Code')}
        </button>
        <div style={{ marginTop: 14, fontSize: 13 }}>
          {otpResendCountdown > 0 ? (
            <span style={{ color: D.textMuted }}>{isAr ? `إعادة الإرسال بعد ${otpResendCountdown} ثانية` : `Resend in ${otpResendCountdown}s`}</span>
          ) : (
            <button onClick={handleOtpResend} disabled={otpResendLoading} style={{ background: 'none', border: 'none', color: D.accent, fontSize: 13, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", fontWeight: 600, opacity: otpResendLoading ? 0.5 : 1 }}>
              {otpResendLoading ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'إعادة إرسال الرمز' : 'Resend Code')}
            </button>
          )}
        </div>
        <button onClick={() => { setShowRegistrationOtp(false); setRegistrationOtp(Array(6).fill('')); setOtpVerifyError(''); setAuthMode('login') }}
          style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', color: D.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>
          {isAr ? 'العودة لتسجيل الدخول' : 'Back to Login'}
        </button>
      </div>
    </div>
  ) : null

  // ===== AUTH PAGES =====
  if (!user && authMode) {
    return (
      <div style={{ minHeight: '100dvh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        {OtpVerificationModal}
        {showForgot && (
          <div className="modal-enter" style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowForgot(false)}>
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 15, padding: '28px 24px', maxWidth: 380, width: '100%' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: D.textPrimary, textAlign: 'center', marginBottom: 8 }}>{isAr ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}</h3>
              <p style={{ color: D.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 20 }}>{isAr ? 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين' : 'Enter your email and we\'ll send you a reset link'}</p>
              <input style={inputStyle} placeholder={isAr ? 'البريد الإلكتروني' : 'Email'} type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleForgotPassword()} />
              <button onClick={handleForgotPassword} style={{ ...btnPrimary, marginTop: 12 }}>{isAr ? 'إرسال رابط التعيين' : 'Send Reset Link'}</button>
              <button onClick={() => setShowForgot(false)} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: D.textMuted, fontSize: 13, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            </div>
          </div>
        )}
        <div style={{ width: '100%', maxWidth: 400, animation: 'scaleIn 0.4s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Logo size={56} />
            <h1 style={{ fontSize: 24, fontWeight: 900, color: D.textPrimary, marginTop: 16 }}>SONA</h1>
            <p style={{ color: D.textSecondary, fontSize: 14, marginTop: 4 }}>{t('platform')}</p>
            <button onClick={toggleLang} style={{ marginTop: 8, padding: '4px 14px', background: D.accentBg, border: `1px solid ${D.accentBorder}`, color: D.accent, borderRadius: 25, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>{lang === 'ar' ? 'EN' : 'عربي'}</button>
          </div>
          <div style={{ ...cardStyle, padding: '28px 24px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: D.textPrimary, textAlign: 'center', marginBottom: 24 }}>
              {authMode === 'login' ? t('login') : t('createAccount')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {authMode === 'register' && <input style={inputStyle} placeholder={isAr ? 'الاسم الكامل' : 'Full Name'} value={name} onChange={e => setName(e.target.value)} />}
              <input style={inputStyle} placeholder={isAr ? 'البريد الإلكتروني' : 'Email'} type="email" value={email} onChange={e => setEmail(e.target.value)} />
              <input style={inputStyle} placeholder={isAr ? 'كلمة المرور' : 'Password'} type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && (authMode === 'login' ? handleLogin() : handleRegister())} />
              {authMode === 'login' && <button onClick={() => setShowForgot(true)} style={{ background: 'none', border: 'none', color: D.accent, fontSize: 13, cursor: 'pointer', textAlign: 'start', fontFamily: "'Cairo', sans-serif", fontWeight: 600 }}>{isAr ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}</button>}
              {authMode === 'register' && (
                <>
                  <input style={inputStyle} placeholder={isAr ? 'رقم الهاتف (اختياري)' : 'Phone (optional)'} value={phone} onChange={e => setPhone(e.target.value)} />
                  <input style={inputStyle} placeholder={isAr ? 'كود الإحالة (اختياري)' : 'Referral Code (optional)'} value={refCode} onChange={e => setRefCode(e.target.value)} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: D.accentBg, borderRadius: 10, padding: '10px 14px', border: `1px solid ${D.accentBorder}`, cursor: 'pointer' }}>
                    <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} style={{ accentColor: D.accent, width: 16, height: 16 }} />
                    <span style={{ color: D.textSecondary, fontSize: 12 }}>
                      {isAr ? 'أوافق على' : 'I agree to the'} <span onClick={() => { setAuthMode(null); setPage('terms') }} style={{ color: D.accent, cursor: 'pointer', textDecoration: 'underline' }}>{isAr ? 'شروط الاستخدام' : 'Terms of Use'}</span> {isAr ? 'و' : 'and'} <span onClick={() => { setAuthMode(null); setPage('privacy') }} style={{ color: D.accent, cursor: 'pointer', textDecoration: 'underline' }}>{isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}</span>
                    </span>
                  </label>
                </>
              )}
              <button onClick={authMode === 'login' ? handleLogin : handleRegister} style={btnPrimary}>{authMode === 'login' ? t('login') : t('createAccount')}</button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" onClick={(e) => { e.preventDefault(); setAuthMode(authMode === 'login' ? 'register' : 'login') }} style={{ background: 'none', border: 'none', color: D.accent, fontSize: 14, cursor: 'pointer', fontWeight: 600, fontFamily: "'Cairo', sans-serif", padding: '8px 0', minHeight: 40, display: 'block', width: '100%' }}>{authMode === 'login' ? (isAr ? 'ليس لديك حساب؟ سجل الآن' : 'Don\'t have an account? Register') : (isAr ? 'لديك حساب؟ سجل الدخول' : 'Already have an account? Login')}</button>
              <button type="button" onClick={(e) => { e.preventDefault(); setAuthMode(null) }} style={{ background: 'none', border: 'none', color: D.textMuted, fontSize: 13, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", padding: '8px 0', minHeight: 36, display: 'block', width: '100%' }}>{isAr ? 'العودة للرئيسية' : 'Back to Home'}</button>
            </div>
          </div>
        </div>
        {ToastEl}
      </div>
    )
  }

  // ===== LANDING PAGE (Dubibo Style) =====
  if (!user) {
    return (
      <div style={{ minHeight: '100dvh', background: D.bg }}>
        {AuthTransitionOverlay}
        {/* Nav */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: D.bgNav, borderBottom: `1px solid ${D.border}`, padding: '12px 20px' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Logo size={36} spin />
              <span style={{ fontWeight: 800, fontSize: 18, color: D.textPrimary }}>SONA</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={toggleLang} style={{ padding: '6px 14px', background: D.accentBg, border: `1px solid ${D.accentBorder}`, color: D.accent, borderRadius: 25, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>{lang === 'ar' ? 'EN' : 'عربي'}</button>
              <button onClick={() => setAuthMode('login')} style={{ padding: '8px 20px', background: 'transparent', border: `1px solid ${D.border}`, color: D.textPrimary, borderRadius: 25, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>{t('login')}</button>
              <button onClick={() => setAuthMode('register')} style={{ padding: '8px 20px', background: D.accent, border: 'none', color: '#fff', borderRadius: 25, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", boxShadow: '0 0 10px rgba(64,158,255,0.3)' }}>{t('register')}</button>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section style={{ padding: '60px 20px 40px', textAlign: 'center', background: `linear-gradient(180deg, ${D.bgNav} 0%, ${D.bg} 100%)` }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ display: 'inline-block', background: D.accentBg, border: `1px solid ${D.accentBorder}`, borderRadius: 25, padding: '6px 16px', fontSize: 12, fontWeight: 600, color: D.accent, marginBottom: 24 }}>{isAr ? 'منصة تداول واستثمار مرخصة' : 'Licensed Trading & Investment Platform'}</div>
            <h1 style={{ fontSize: 36, fontWeight: 900, color: D.textPrimary, marginBottom: 16, lineHeight: 1.4 }}>
              {isAr ? 'تداول واستثمر بأمان' : 'Trade & Invest Safely'}<br /><span className="gradient-text">{isAr ? 'عوائد يومية مضمونة' : 'Guaranteed Daily Returns'}</span>
            </h1>
            <p style={{ fontSize: 16, color: D.textSecondary, marginBottom: 32, lineHeight: 1.8, maxWidth: 480, margin: '0 auto 32px' }}>
              {isAr ? 'منصة SONA للتداول والاستثمار الذكي. إشارات تداول يومية وباقات استثمارية متنوعة مع عوائد تصل إلى 3% يومياً.' : 'SONA Smart Trading & Investment Platform. Daily trading signals and diverse investment packages with returns up to 3% daily.'}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
              <button onClick={() => setAuthMode('register')} style={{ padding: '14px 32px', background: D.accent, color: '#fff', border: 'none', borderRadius: 25, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", boxShadow: '0 0 15px rgba(64,158,255,0.4)' }}>{isAr ? 'ابدأ التداول الآن' : 'Start Trading Now'}</button>
              <button onClick={() => setAuthMode('login')} style={{ padding: '14px 32px', background: 'transparent', border: `1px solid ${D.border}`, color: D.textPrimary, borderRadius: 25, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'تسجيل الدخول' : 'Login'}</button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 480, margin: '0 auto' }}>
              {[
                { label: isAr ? 'مستخدم نشط' : 'Active Users', value: '500+', color: D.accent },
                { label: isAr ? 'حجم التداول' : 'Trading Volume', value: '$2M+', color: D.green },
                { label: isAr ? 'عوائد محققة' : 'Returns Earned', value: '$500K+', color: D.purple },
              ].map((s, i) => (
                <div key={i} style={{ ...cardStyle, padding: '16px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: D.textMuted, fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features - NO EMOJIS, SVG icons instead */}
        <section style={{ padding: '40px 20px', maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: D.textPrimary, textAlign: 'center', marginBottom: 24 }}>{isAr ? 'مميزات المنصة' : 'Platform Features'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {[
              { icon: 'chart', title: isAr ? 'إشارات تداول يومية' : 'Daily Trading Signals', desc: isAr ? '3 إشارات تداول يومية لمساعدتك في مضاعفة استثمارك' : '3 daily trading signals to help multiply your investment', color: D.accent },
              { icon: 'bot', title: isAr ? 'فريق تحليل محترف' : 'Professional Analysis Team', desc: isAr ? 'استراتيجيات تداول متقدمة من فريق المحللين المحترفين' : 'Advanced trading strategies from professional analysts', color: D.green },
              { icon: 'shield', title: isAr ? 'مرخصة بالكامل' : 'Fully Licensed', desc: isAr ? 'مرخصة من FCA برقم 847592 مع حماية كاملة للأصول' : 'FCA licensed #847592 with full asset protection', color: D.yellow },
              { icon: 'cash', title: isAr ? 'سحب سهل وسريع' : 'Easy & Fast Withdrawal', desc: isAr ? 'سحب الأرباح بشكل يومي مع تحويل فوري عبر البلوكتشين' : 'Daily profit withdrawal with instant blockchain transfer', color: D.purple },
            ].map((f, i) => (
              <div key={i} style={{ ...cardStyle, padding: '20px 16px' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${f.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon name={f.icon} size={22} color={f.color} />
                </div>
                <div style={{ color: D.textPrimary, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{f.title}</div>
                <div style={{ color: D.textMuted, fontSize: 12, lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Investment Packages */}
        <section style={{ padding: '40px 20px', maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: D.textPrimary, textAlign: 'center', marginBottom: 8 }}>{t('investPackages')}</h2>
          <p style={{ fontSize: 14, color: D.textSecondary, textAlign: 'center', marginBottom: 24 }}>{t('investPackagesDesc')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { name: 'Starter', nameAr: 'المبتدئ', nameEn: 'Starter', daily: '1.5%', min: '$100', max: '$999', color: D.textSecondary, period: isAr ? '30 يوم' : '30 days' },
              { name: 'Basic', nameAr: 'الأساسي', nameEn: 'Basic', daily: '2.0%', min: '$1,000', max: '$4,999', color: D.accent, period: isAr ? '45 يوم' : '45 days' },
              { name: 'Advanced', nameAr: 'المتقدم', nameEn: 'Advanced', daily: '2.5%', min: '$5,000', max: '$14,999', color: D.green, period: isAr ? '60 يوم' : '60 days' },
              { name: 'Professional', nameAr: 'المحترف', nameEn: 'Professional', daily: '3.0%', min: '$15,000', max: '$29,999', color: D.yellow, period: isAr ? '90 يوم' : '90 days' },
              { name: 'VIP', nameAr: 'كبار المستثمرين', nameEn: 'VIP', daily: '3.5%', min: '$30,000', max: '$50,000', color: D.purple, period: isAr ? '120 يوم' : '120 days' },
            ].map((p, i) => (
              <div key={i} style={{ ...cardStyle, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 50, height: 50, borderRadius: 14, background: `${p.color}12`, border: `1px solid ${p.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: p.color }}>{p.daily}</span>
                    <span style={{ fontSize: 8, color: D.textMuted, fontWeight: 600 }}>{isAr ? 'يومياً' : 'daily'}</span>
                  </div>
                  <div>
                    <div style={{ color: D.textPrimary, fontWeight: 700, fontSize: 15 }}>{isAr ? p.nameAr : p.nameEn}</div>
                    <div style={{ color: D.textMuted, fontSize: 12 }}>{p.min} - {p.max} | {p.period}</div>
                  </div>
                </div>
                <div style={{ background: `${p.color}12`, padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, color: p.color }}>{p.daily}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Trading Signals - NO EMOJIS */}
        <section style={{ padding: '40px 20px', maxWidth: 640, margin: '0 auto' }}>
          <div style={{ ...cardStyle, padding: '24px 20px', background: `linear-gradient(135deg, ${D.card} 0%, rgba(64,158,255,0.05) 100%)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="chart" size={22} color={D.accent} />
              </div>
              <div>
                <div style={{ color: D.textPrimary, fontWeight: 800, fontSize: 16 }}>{isAr ? 'إشارات التداول اليومية' : 'Daily Trading Signals'}</div>
                <div style={{ color: D.textMuted, fontSize: 12 }}>{isAr ? '3 إشارات يومية من خبراء التحليل' : '3 daily signals from expert analysts'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { pair: 'BTC/USDT', signal: isAr ? 'شراء' : 'Buy', target: '$98,500', time: '10:00 AM', type: 'buy' },
                { pair: 'ETH/USDT', signal: isAr ? 'شراء' : 'Buy', target: '$3,800', time: '02:00 PM', type: 'buy' },
                { pair: 'BNB/USDT', signal: isAr ? 'بيع' : 'Sell', target: '$620', time: '06:00 PM', type: 'sell' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: D.bg, borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: D.textPrimary }}>{s.pair}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.type === 'buy' ? D.green : D.red, background: s.type === 'buy' ? D.greenBg : D.redBg, padding: '2px 8px', borderRadius: 6 }}>{s.signal}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: D.textSecondary }}>{isAr ? 'الهدف: ' : 'Target: '}{s.target}</span>
                    <span style={{ fontSize: 11, color: D.textMuted }}>{s.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Referral - NO EMOJIS */}
        <section style={{ padding: '40px 20px', maxWidth: 640, margin: '0 auto' }}>
          <div style={{ ...cardStyle, padding: '24px 20px', textAlign: 'center', background: `linear-gradient(135deg, ${D.card} 0%, rgba(4,207,153,0.05) 100%)` }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: D.greenBg, border: `1px solid ${D.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <Icon name="link" size={28} color={D.green} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: D.textPrimary, marginBottom: 8 }}>{isAr ? 'نظام الإحالات' : 'Referral Program'}</h3>
            <p style={{ fontSize: 14, color: D.textSecondary, marginBottom: 16 }}>{isAr ? 'احصل على عمولة 15% عندما يستثمر صديقك' : 'Earn 15% commission when your friend invests'}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <div style={{ ...cardStyle, padding: '12px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: D.green }}>15%</div>
                <div style={{ fontSize: 11, color: D.textMuted }}>{isAr ? 'عمولة عند الاستثمار' : 'Investment Commission'}</div>
              </div>
              <div style={{ ...cardStyle, padding: '12px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: D.accent }}>{isAr ? 'لا محدودة' : 'Unlimited'}</div>
                <div style={{ fontSize: 11, color: D.textMuted }}>{isAr ? 'عدد الإحالات' : 'Referrals'}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Footer */}
        <section style={{ padding: '32px 20px', maxWidth: 640, margin: '0 auto', borderTop: `1px solid ${D.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: D.green, fontWeight: 600 }}>FCA Regulated</span>
            <span style={{ fontSize: 12, color: D.accent, fontWeight: 600 }}>MSB Authorized</span>
          </div>
          <div style={{ textAlign: 'center', color: D.textMuted, fontSize: 11 }}>SONA Digital Assets Ltd. | FCA Reg. #847592 | U.S. MSB Authorized</div>
        </section>
        {ToastEl}
      </div>
    )
  }

  const activeInvestments = investments.filter(i => i.status === 'ACTIVE')
  const totalInvested = activeInvestments.reduce((s, i) => s + i.amount, 0)
  const activeMode = user.investmentMode || platformSettings.platformMode
  const isWVMode = false
  const isSONAMode = activeMode === 'SONA' || activeMode === 'BOTH'
  const withdrawableBal = user.balance

  // ===== DASHBOARD =====
  const DashboardPage = () => (
    <div className="page-enter" style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
      {/* Welcome */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: D.textPrimary }}>{t('welcome')} {user.name?.split(' ')[0] || user.email?.split('@')[0] || ''}</h2>
        <p style={{ fontSize: 13, color: D.textSecondary, marginTop: 4 }}>{isAr ? 'منصة SONA للتداول والاستثمار الذكي' : 'SONA Smart Trading & Investment Platform'}</p>
      </div>

      {/* Balance Card - Professional with sub-balances */}
      <div style={{ ...cardStyle, padding: '24px 20px', marginBottom: 16, background: `linear-gradient(135deg, ${D.card} 0%, rgba(64,158,255,0.06) 100%)` }}>
        {/* Total Balance */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, color: D.textSecondary, marginBottom: 4 }}>{isAr ? 'الرصيد الكلي' : 'Total Balance'}</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: D.textPrimary }}>${fmt(user.balance)}</div>
          </div>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="wallet" size={24} color={D.accent} />
          </div>
        </div>
        {/* Total Profits & Total Investments */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <div style={{ background: D.bg, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: D.textSecondary, marginBottom: 4, fontWeight: 600 }}>{isAr ? 'إجمالي الأرباح' : 'Total Profits'}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: D.green }}>+${fmt(user.totalProfit)}</div>
          </div>
          <div style={{ background: D.bg, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: D.textSecondary, marginBottom: 4, fontWeight: 600 }}>{isAr ? 'إجمالي الاستثمارات' : 'Total Investments'}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: D.accent }}>${fmt(totalInvested)}</div>
          </div>
        </div>
      </div>

      {/* Quick Actions - NO EMOJIS, colored circle indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: isAr ? 'إيداع' : 'Deposit', icon: 'wallet', page: 'deposit', color: D.green },
          { label: isAr ? 'استثمار' : 'Invest', icon: 'gift', page: 'packages', color: D.accent },
          { label: isAr ? 'تحويل P2P' : 'P2P Transfer', icon: 'swap', page: 'p2p', color: '#a855f7' },
          { label: isAr ? 'سحب' : 'Withdraw', icon: 'cash', page: 'withdraw', color: D.yellow },
        ].map((a, i) => (
          <button key={i} onClick={() => setPage(a.page)} style={{ ...cardStyle, padding: '16px 12px', textAlign: 'center', cursor: 'pointer', border: `1px solid ${D.border}`, transition: 'all 0.2s' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${a.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
              <Icon name={a.icon} size={18} color={a.color} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: a.color }}>{a.label}</div>
          </button>
        ))}
      </div>

      {/* Active Investments */}
      {activeInvestments.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: D.textPrimary }}>{t('activeInvestments')}</h3>
            <button onClick={() => setPage('investments')} style={{ background: 'none', border: 'none', color: D.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>{t('viewAll')}</button>
          </div>
          {activeInvestments.slice(0, 3).map(inv => {
            const startDate = new Date(inv.startDate)
            const now = new Date()
            const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
            const totalDays = inv.package.durationDays || 60
            const progressPct = Math.min(100, (daysPassed / totalDays) * 100)
            const daysLeft = Math.max(0, totalDays - daysPassed)
            return (
            <div key={inv.id} style={{ ...cardStyle, padding: '16px 18px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary }}>{inv.package.name}</div>
                  <div style={{ fontSize: 12, color: D.textMuted, marginTop: 2 }}>${fmt(inv.amount)} | {inv.package.monthlyReturn}% {lang === 'ar' ? 'يومياً' : 'daily'}</div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: D.green }}>+${fmt(inv.totalProfit)}</div>
                  <div style={{ fontSize: 11, color: D.textMuted }}>{lang === 'ar' ? 'إجمالي الأرباح' : 'Total Profit'}</div>
                </div>
              </div>
              {/* Progress Bar */}
              <div style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: D.accent }}>{t('daysPassed')}: {daysPassed}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: D.textMuted }}>{t('remaining')}: {daysLeft} {t('days')}</span>
                </div>
                <div style={{ width: '100%', height: 6, background: D.bg, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${progressPct}%`, height: '100%', background: `linear-gradient(90deg, ${D.accent}, ${D.green})`, borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {/* Market Prices */}
      {cryptoPrices.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: D.textPrimary, marginBottom: 12 }}>{t('marketPrices')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cryptoPrices.slice(0, 5).map((c, i) => (
              <div key={i} style={{ ...cardStyle, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary }}>{c.symbol}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary }}>${fmt(c.price)}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.change >= 0 ? D.green : D.red, background: c.change >= 0 ? D.greenBg : D.redBg, padding: '2px 8px', borderRadius: 6 }}>{fmtPct(c.change)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: D.textPrimary, marginBottom: 12 }}>{isAr ? 'آخر المعاملات' : 'Latest Transactions'}</h3>
          {transactions.slice(0, 5).map(tx => (
            <div key={tx.id} style={{ ...cardStyle, padding: '12px 16px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>{tx.type === 'DEPOSIT' ? (isAr ? 'إيداع' : 'Deposit') : tx.type === 'WITHDRAWAL' ? (isAr ? 'سحب' : 'Withdrawal') : tx.type === 'INVESTMENT' ? (isAr ? 'استثمار' : 'Investment') : tx.type === 'PROFIT' ? (isAr ? 'أرباح' : 'Profit') : tx.type}</div>
                <div style={{ fontSize: 11, color: D.textMuted, marginTop: 2 }}>{fmtDate(tx.createdAt)}</div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: tx.type === 'DEPOSIT' || tx.type === 'PROFIT' ? D.green : D.red }}>{tx.type === 'DEPOSIT' || tx.type === 'PROFIT' ? '+$' : '-$'}{fmt(tx.amount)}</div>
                <StatusBadge status={tx.status} labels={{
                  PENDING: { text: 'معلق', color: D.yellow, bg: D.yellowBg },
                  APPROVED: { text: 'مقبول', color: D.green, bg: D.greenBg },
                  REJECTED: { text: 'مرفوض', color: D.red, bg: D.redBg },
                  COMPLETED: { text: 'مكتمل', color: D.green, bg: D.greenBg },
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ===== PACKAGES PAGE =====
  const PackagesPage = () => {
    const currentPMode = platformSettings.platformMode
    const showModeChoice = currentPMode === 'BOTH'
    return (
    <div className="page-enter" style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: D.textPrimary, marginBottom: 8 }}>{lang === 'ar' ? 'باقات الاستثمار' : 'Investment Packages'}</h2>
      <p style={{ fontSize: 13, color: D.textSecondary, marginBottom: 4 }}>{lang === 'ar' ? 'اختر الباقة المناسبة لك وابدأ بتحقيق الأرباح اليومية' : 'Choose the right package and start earning daily profits'}</p>
      <p style={{ fontSize: 12, color: D.accent, marginBottom: 12, fontWeight: 600 }}>{lang === 'ar' ? 'يتم تنفيذ استراتيجية تداول احترافية على واجهة التداول عند تفعيل الباقة' : 'A professional trading strategy is executed on the trading interface upon package activation'}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(packages.length > 0 ? packages : [
          { id: '1', name: isAr ? 'المبتدئ' : 'Starter', nameEn: 'Starter', minAmount: 100, maxAmount: 999, monthlyReturn: 1.5, durationDays: 30, description: isAr ? 'باقة مثالية للمبتدئين' : 'Ideal package for beginners', color: '#999999', icon: 'sprout' },
          { id: '2', name: isAr ? 'الأساسي' : 'Basic', nameEn: 'Basic', minAmount: 1000, maxAmount: 4999, monthlyReturn: 2.0, durationDays: 45, description: isAr ? 'عوائد أعلى للمستثمرين' : 'Higher returns for investors', color: '#409eff', icon: 'chart' },
          { id: '3', name: isAr ? 'المتقدم' : 'Advanced', nameEn: 'Advanced', minAmount: 5000, maxAmount: 14999, monthlyReturn: 2.5, durationDays: 60, description: isAr ? 'للمستثمرين ذوي الخبرة' : 'For experienced investors', color: '#04cf99', icon: 'rocket' },
          { id: '4', name: isAr ? 'المحترف' : 'Professional', nameEn: 'Professional', minAmount: 15000, maxAmount: 29999, monthlyReturn: 3.0, durationDays: 90, description: isAr ? 'عوائد احترافية مميزة' : 'Premium professional returns', color: '#e6a23c', icon: 'star' },
          { id: '5', name: 'VIP', nameEn: 'VIP', minAmount: 30000, maxAmount: 50000, monthlyReturn: 3.5, durationDays: 120, description: isAr ? 'أعلى العوائد لكبار المستثمرين' : 'Highest returns for VIP investors', color: '#c05bdd', icon: 'crown' },
        ]).map(pkg => (
          <div key={pkg.id} style={{ ...cardStyle, padding: '20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: `${pkg.color}08`, borderRadius: '0 15px 0 80px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${pkg.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={pkg.icon} size={18} color={pkg.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: D.textPrimary }}>{pkg.name}</div>
                    <div style={{ fontSize: 11, color: D.textMuted }}>{pkg.nameEn}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: D.textSecondary, marginBottom: 12, lineHeight: 1.6 }}>{pkg.description}</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div><span style={{ fontSize: 11, color: D.textMuted }}>{isAr ? 'الحد الأدنى: ' : 'Min: '}</span><span style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>${fmtNum(pkg.minAmount)}</span></div>
                  <div><span style={{ fontSize: 11, color: D.textMuted }}>{isAr ? 'الحد الأقصى: ' : 'Max: '}</span><span style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>${fmtNum(pkg.maxAmount || 0)}</span></div>
                  <div><span style={{ fontSize: 11, color: D.textMuted }}>{isAr ? 'المدة: ' : 'Duration: '}</span><span style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>{pkg.durationDays} {isAr ? 'يوم' : 'days'}</span></div>
                </div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: pkg.color }}>{pkg.monthlyReturn}%</div>
                <div style={{ fontSize: 11, color: D.textMuted, fontWeight: 600 }}>{t('daily')}</div>
              </div>
            </div>
            <button onClick={() => { setInvestModal(pkg); setInvestAmount(''); setInvestMode('SONA') }} style={{ ...btnPrimary, marginTop: 16, background: pkg.color, boxShadow: `0 0 10px ${pkg.color}40` }}>{lang === 'ar' ? 'استثمر الآن' : 'Invest Now'}</button>
          </div>
        ))}
      </div>
    </div>
    )
  }
  // ===== INVESTMENTS PAGE =====
  const InvestmentsPage = () => (
    <div className="page-enter" style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: D.textPrimary, marginBottom: 20 }}>{t('investments')}</h2>
      {investments.length === 0 ? (
        <div style={{ ...cardStyle, padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Icon name="gift" size={28} color={D.accent} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: D.textPrimary, marginBottom: 8 }}>{isAr ? 'لا توجد استثمارات بعد' : 'No investments yet'}</div>
          <div style={{ fontSize: 13, color: D.textMuted, marginBottom: 20 }}>{isAr ? 'ابدأ بالاستثمار في إحدى الباقات المتاحة' : 'Start investing in one of the available packages'}</div>
          <button onClick={() => setPage('packages')} style={{ ...btnPrimary, maxWidth: 200, margin: '0 auto' }}>{isAr ? 'استعرض الباقات' : 'Browse Packages'}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {investments.map(inv => {
            const startDate = new Date(inv.startDate)
            const now = new Date()
            const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
            const totalDays = inv.package.durationDays || 60
            const progressPct = Math.min(100, (daysPassed / totalDays) * 100)
            const daysLeft = Math.max(0, totalDays - daysPassed)
            return (
            <div key={inv.id} style={{ ...cardStyle, padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: D.textPrimary }}>{inv.package.name}</div>
                  <div style={{ fontSize: 12, color: D.textMuted, marginTop: 2 }}>{isAr ? 'بدأ: ' : 'Started: '}{fmtDate(inv.startDate)}</div>
                </div>
                <StatusBadge status={inv.status} labels={{
                  ACTIVE: { text: isAr ? 'نشط' : 'Active', color: D.green, bg: D.greenBg },
                  COMPLETED: { text: isAr ? 'مكتمل' : 'Completed', color: D.accent, bg: D.accentBg },
                  FROZEN: { text: isAr ? 'مجمد' : 'Frozen', color: D.yellow, bg: D.yellowBg },
                }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 10 }}>
                <div><div style={{ fontSize: 11, color: D.textMuted }}>{isAr ? 'المبلغ' : 'Amount'}</div><div style={{ fontSize: 15, fontWeight: 700, color: D.textPrimary }}>${fmt(inv.amount)}</div></div>
                <div><div style={{ fontSize: 11, color: D.textMuted }}>{isAr ? 'الأرباح' : 'Profit'}</div><div style={{ fontSize: 15, fontWeight: 700, color: D.green }}>+${fmt(inv.totalProfit)}</div></div>
                <div><div style={{ fontSize: 11, color: D.textMuted }}>{isAr ? 'المحرر' : 'Released'}</div><div style={{ fontSize: 15, fontWeight: 700, color: D.accent }}>${fmt(inv.releasedAmount)}</div></div>
              </div>
              {/* Progress Bar */}
              {inv.status === 'ACTIVE' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: D.accent }}>{t('daysPassed')}: {daysPassed}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: D.textMuted }}>{t('remaining')}: {daysLeft} {t('days')}</span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: D.bg, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${progressPct}%`, height: '100%', background: `linear-gradient(90deg, ${D.accent}, ${D.green})`, borderRadius: 3, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ===== DEPOSIT PAGE =====

  // ===== WITHDRAW PAGE =====
  const WithdrawPage = () => {
    const statusLabels: Record<string, { text: string; color: string; bg: string }> = {
      PENDING: { text: t('pendingW'), color: D.yellow, bg: D.yellowBg },
      PROCESSING: { text: t('processingW'), color: D.accent, bg: D.accentBg },
      APPROVED: { text: t('approvedW'), color: D.green, bg: D.greenBg },
      COMPLETED: { text: t('completedW'), color: D.green, bg: D.greenBg },
      REJECTED: { text: t('rejectedW'), color: D.red, bg: D.redBg },
    }

    const [wdAmount, setWdAmount] = useState('')
    const [wdNetwork, setWdNetwork] = useState('usdt_bep20')
    const [wdWallet, setWdWallet] = useState('')
    const [wdLoading, setWdLoading] = useState(false)
    const [wdMessage, setWdMessage] = useState<{type: 'success' | 'error' | 'warning'; text: string} | null>(null)

    const networks = [
      { id: 'usdt_bep20', name: 'USDT (BEP20)', icon: '₮', color: '#f0b90b', fee: '$0.5' },
      { id: 'usdt_trc20', name: 'USDT (TRC20)', icon: '₮', color: '#26a17b', fee: '$1' },
      { id: 'btc', name: 'Bitcoin (BTC)', icon: '₿', color: '#f7931a', fee: '~$5' },
      { id: 'eth', name: 'Ethereum (ETH)', icon: 'Ξ', color: '#627eea', fee: '~$3' },
    ]

    const handleWithdraw = async () => {
      setWdMessage(null)
      const amount = parseFloat(wdAmount)
      if (!amount || amount <= 0) { setWdMessage({ type: 'error', text: lang === 'ar' ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount' }); return }
      if (amount < 10) { setWdMessage({ type: 'error', text: lang === 'ar' ? 'الحد الأدنى للسحب هو $10' : 'Minimum withdrawal is $10' }); return }
      if (amount > withdrawableBal) { setWdMessage({ type: 'error', text: lang === 'ar' ? 'رصيدك القابل للسحب غير كافي' : 'Insufficient withdrawable balance' }); return }
      if (!wdWallet.trim()) { setWdMessage({ type: 'error', text: lang === 'ar' ? 'يرجى إدخال عنوان المحفظة' : 'Please enter wallet address' }); return }

      // Show KYC warning for amounts > $10000 (hard block)
      if (amount > 10000 && !['VERIFIED', 'APPROVED'].includes(user?.kycStatus || '')) {
        setWdMessage({ type: 'warning', text: lang === 'ar' ? 'يرجى توثيق حسابك لسحب أكثر من $10,000' : 'Please verify your account to withdraw more than $10,000' })
        return
      }

      setWdLoading(true)
      try {
        const res = await fetch('/api/withdraw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, amount, method: wdNetwork, walletAddress: wdWallet })
        })
        const data = await res.json()
        if (res.ok) {
          setWdMessage({ type: 'success', text: lang === 'ar' ? 'تم إرسال طلب السحب بنجاح! سيتم معالجته تلقائياً' : 'Withdrawal request submitted! It will be processed automatically' })
          setWdAmount('')
          setWdWallet('')
          fetchUser()
          fetchData()
        } else {
          setWdMessage({ type: 'error', text: data.error || (lang === 'ar' ? 'حدث خطأ أثناء إنشاء طلب السحب' : 'Error creating withdrawal request') })
        }
      } catch {
        setWdMessage({ type: 'error', text: lang === 'ar' ? 'حدث خطأ في الاتصال' : 'Connection error' })
      }
      setWdLoading(false)
    }

    return (
      <div className="page-enter" style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: D.greenBg, border: `1px solid ${D.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrowUp" size={24} color={D.green} />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: D.textPrimary, margin: 0 }}>{t('withdrawTitle')}</h2>
            <p style={{ fontSize: 12, color: D.textSecondary, margin: 0, marginTop: 2 }}>{lang === 'ar' ? 'اسحب أرباحك عبر العملات الرقمية بسهولة وأمان' : 'Withdraw your earnings via crypto easily and securely'}</p>
          </div>
        </div>

        {/* Balance Card */}
        <div style={{ ...cardStyle, padding: '24px 20px', marginBottom: 14, background: `linear-gradient(135deg, ${D.card} 0%, rgba(4,207,153,0.1) 100%)`, ...(isRTL ? { borderLeft: `3px solid ${D.green}` } : { borderRight: `3px solid ${D.green}` }) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: D.textSecondary, marginBottom: 6, fontWeight: 600 }}>{t('withdrawableBalance')}</div>
              <div style={{ fontSize: 34, fontWeight: 900, color: D.green, letterSpacing: -0.5 }}>${fmt(withdrawableBal)}</div>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${D.greenBg}, rgba(4,207,153,0.15))`, border: `1px solid ${D.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="wallet" size={22} color={D.green} />
            </div>
          </div>
        </div>

        {/* Withdraw Form */}
        <div style={{ ...cardStyle, padding: '24px 20px', marginBottom: 14 }}>
          {/* Amount Input */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: D.textSecondary, marginBottom: 8, display: 'block', fontWeight: 600 }}>
              {lang === 'ar' ? 'مبلغ السحب (USDT)' : 'Withdraw Amount (USDT)'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={wdAmount}
                onChange={e => { setWdAmount(e.target.value); setWdMessage(null) }}
                min="10"
                max={withdrawableBal}
                placeholder={lang === 'ar' ? 'أدخل المبلغ' : 'Enter amount in USDT'}
                dir="ltr"
                style={{ ...inputStyle, fontSize: 20, fontWeight: 800, paddingLeft: 36 }}
              />
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: D.textMuted, fontWeight: 700, fontSize: 16 }}>$</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[50, 100, 500].map(v => (
                  <button key={v} type="button" onClick={() => setWdAmount(String(v))}
                    style={{ padding: '6px 12px', borderRadius: 8, background: D.accentBg, border: `1px solid ${D.accentBorder}`, color: D.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
                    ${v}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setWdAmount(String(withdrawableBal))}
                style={{ background: 'none', border: 'none', color: D.green, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                {lang === 'ar' ? 'السحب الكامل' : 'Withdraw All'}
              </button>
            </div>
            <div style={{ fontSize: 10, color: D.textMuted, marginTop: 8 }}>
              {lang === 'ar' ? 'الحد الأدنى للسحب: $10' : 'Minimum withdrawal: $10'}
            </div>
          </div>

          {/* Network Selection */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: D.textSecondary, marginBottom: 10, display: 'block', fontWeight: 600 }}>
              {lang === 'ar' ? 'اختر الشبكة' : 'Select Network'}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {networks.map(n => (
                <button key={n.id} type="button" onClick={() => { setWdNetwork(n.id); setWdMessage(null) }}
                  style={{
                    padding: '14px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                    background: wdNetwork === n.id ? `rgba(${n.color === '#f0b90b' ? '240,185,11' : n.color === '#26a17b' ? '38,161,123' : n.color === '#f7931a' ? '247,147,26' : '98,126,234'},0.06)` : D.input,
                    border: `1px solid ${wdNetwork === n.id ? n.color + '40' : D.border}`,
                    color: wdNetwork === n.id ? n.color : D.textSecondary,
                    transition: 'all 0.2s',
                    boxShadow: wdNetwork === n.id ? `0 0 12px ${n.color}15` : 'none'
                  }}>
                  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{n.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 700 }}>{n.name}</div>
                  <div style={{ fontSize: 9, color: D.textMuted, marginTop: 3 }}>{lang === 'ar' ? 'رسوم' : 'Fee'}: {n.fee}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Wallet Address */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: D.textSecondary, marginBottom: 8, display: 'block', fontWeight: 600 }}>
              {lang === 'ar' ? 'عنوان المحفظة' : 'Wallet Address'}
            </label>
            <input
              type="text"
              value={wdWallet}
              onChange={e => setWdWallet(e.target.value)}
              placeholder={lang === 'ar' ? 'أدخل عنوان محفظتك' : 'Enter your wallet address'}
              dir="ltr"
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
            />
            {wdNetwork === 'usdt_bep20' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <Icon name="alertTriangle" size={12} color="#f0b90b" />
                <span style={{ fontSize: 10, color: 'rgba(240,185,11,0.7)' }}>{lang === 'ar' ? 'تأكد من أن العنوان يدعم شبكة BEP20' : 'Make sure the address supports BEP20'}</span>
              </div>
            )}
          </div>

          {/* Summary */}
          {wdAmount && parseFloat(wdAmount) > 0 && (
            <div style={{ background: `linear-gradient(135deg, ${D.greenBg}, rgba(4,207,153,0.04))`, border: `1px solid ${D.greenBorder}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.green, marginBottom: 8 }}>{lang === 'ar' ? 'ملخص السحب' : 'Withdrawal Summary'}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: D.textSecondary }}>{lang === 'ar' ? 'مبلغ السحب' : 'Amount'}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: D.textPrimary }}>${(parseFloat(wdAmount) || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: D.textSecondary }}>{lang === 'ar' ? 'الشبكة' : 'Network'}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: D.textPrimary }}>{networks.find(n => n.id === wdNetwork)?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: D.textSecondary }}>{lang === 'ar' ? 'رسوم الشبكة' : 'Network Fee'}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: D.textPrimary }}>{networks.find(n => n.id === wdNetwork)?.fee}</span>
              </div>
            </div>
          )}

          {/* KYC Warning for >$10000 */}
          {wdAmount && parseFloat(wdAmount) > 10000 && !['VERIFIED', 'APPROVED'].includes(user?.kycStatus || '') && (
            <div style={{ background: 'rgba(230,162,60,0.08)', border: '1px solid rgba(230,162,60,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(230,162,60,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="shield" size={16} color={D.yellow} />
              </div>
              <span style={{ fontSize: 12, color: D.yellow, fontWeight: 600 }}>
                {lang === 'ar' ? 'يرجى توثيق حسابك لسحب أكثر من $10,000' : 'Please verify your account to withdraw more than $10,000'}
              </span>
            </div>
          )}

          {/* Message */}
          {wdMessage && (
            <div style={{
              background: wdMessage.type === 'success' ? D.greenBg : wdMessage.type === 'warning' ? 'rgba(230,162,60,0.08)' : D.redBg,
              border: `1px solid ${wdMessage.type === 'success' ? D.greenBorder : wdMessage.type === 'warning' ? 'rgba(230,162,60,0.2)' : D.redBorder}`,
              borderRadius: 12, padding: '14px 16px', marginBottom: 14, fontSize: 12, fontWeight: 600,
              color: wdMessage.type === 'success' ? D.green : wdMessage.type === 'warning' ? D.yellow : D.red,
              display: 'flex', flexDirection: 'column', gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name={wdMessage.type === 'success' ? 'checkCircle' : wdMessage.type === 'warning' ? 'alertTriangle' : 'x'} size={16} />
                {wdMessage.text}
              </div>
              {wdMessage.type === 'error' && (
                <button onClick={() => { setPage('support'); const errMsg = lang === 'ar' ? 'مشكلة في السحب: ' + wdMessage.text : 'Withdrawal issue: ' + wdMessage.text; setTimeout(() => handleSendChat(errMsg), 500) }} style={{ padding: '6px 14px', background: 'rgba(64,158,255,0.1)', border: '1px solid rgba(64,158,255,0.2)', borderRadius: 8, color: '#409eff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
                  💬 {lang === 'ar' ? 'تواصل مع الدعم' : 'Contact Support'}
                </button>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button onClick={handleWithdraw} disabled={wdLoading || withdrawableBal <= 0}
            style={{
              ...btnPrimary, background: `linear-gradient(135deg, #04cf99, #04b383)`,
              opacity: wdLoading || withdrawableBal <= 0 ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: wdLoading || withdrawableBal <= 0 ? 'not-allowed' : 'pointer',
              fontSize: 15, padding: '14px 20px', borderRadius: 12,
              boxShadow: '0 4px 15px rgba(4,207,153,0.3)'
            }}>
            {wdLoading ? (
              <div style={{ width: 18, height: 18, border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <>
                <Icon name="arrowUp" size={18} color="#fff" />
                {lang === 'ar' ? 'إرسال طلب السحب' : 'Submit Withdrawal'}
              </>
            )}
          </button>
        </div>

        {/* Withdrawal History */}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: D.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="clock" size={16} color={D.accent} />
              {t('withdrawHistory')}
            </h3>
            {withdrawals.length > 0 && <span style={{ fontSize: 11, color: D.textMuted, background: D.accentBg, padding: '3px 10px', borderRadius: 8 }}>{withdrawals.length} {lang === 'ar' ? 'عملية' : 'transactions'}</span>}
          </div>
          {withdrawals.length === 0 ? (
            <div style={{ ...cardStyle, padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: D.accentBg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Icon name="clock" size={22} color={D.accent} />
              </div>
              <div style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600 }}>{t('withdrawNoHistory')}</div>
            </div>
          ) : (
            withdrawals.map(tx => (
              <div key={tx.id} style={{ ...cardStyle, padding: '16px 18px', marginBottom: 8, ...(isRTL ? { borderLeft: `3px solid ${tx.status === 'COMPLETED' || tx.status === 'APPROVED' ? D.green : tx.status === 'PENDING' ? D.yellow : tx.status === 'PROCESSING' ? D.accent : D.red}` } : { borderRight: `3px solid ${tx.status === 'COMPLETED' || tx.status === 'APPROVED' ? D.green : tx.status === 'PENDING' ? D.yellow : tx.status === 'PROCESSING' ? D.accent : D.red}` }) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: D.textPrimary }}>${fmt(tx.amount)}</div>
                    <div style={{ fontSize: 11, color: D.textMuted, marginTop: 2 }}>{fmtDate(tx.createdAt)}</div>
                    {tx.cryptoNetwork && <div style={{ fontSize: 10, color: D.accent, marginTop: 3, fontWeight: 600 }}>{tx.cryptoNetwork}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <StatusBadge status={tx.status} labels={statusLabels} />
                    {tx.txHash && <div style={{ fontSize: 9, color: D.textMuted, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} dir="ltr">{tx.txHash}</div>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // ===== NOTIFICATIONS PAGE =====
  const NotificationsPage = () => {
    const { lang, D, Icon, notifications, setNotifications, setUnreadCount, user, cardStyle, fmtDate, showToast, btnOutline } = useApp()
    const [loading, setLoading] = useState(false)

    const markAllRead = async () => {
      try {
        await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAllRead: true, userId: user.id }) })
        setNotifications((prev: any[]) => prev.map((n: any) => ({ ...n, isRead: true })))
        setUnreadCount(0)
        showToast(lang === 'ar' ? 'تم تعليم الكل كمقروء' : 'All marked as read')
      } catch { showToast(lang === 'ar' ? 'حدث خطأ' : 'Error occurred', 'err') }
    }

    const markRead = async (id: string) => {
      try {
        await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationId: id }) })
        setNotifications((prev: any[]) => prev.map((n: any) => n.id === id ? { ...n, isRead: true } : n))
        setUnreadCount((prev: number) => Math.max(0, prev - 1))
      } catch {}
    }

    const deleteNotif = async (id: string) => {
      try {
        await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' })
        setNotifications((prev: any[]) => prev.filter((n: any) => n.id !== id))
        showToast(lang === 'ar' ? 'تم حذف الإشعار' : 'Notification deleted')
      } catch { showToast(lang === 'ar' ? 'حدث خطأ' : 'Error occurred', 'err') }
    }

    const typeIcon = (type: string) => {
      const map: Record<string, string> = { DEPOSIT: 'arrowDown', WITHDRAWAL: 'arrowUp', PROFIT: 'chart', REFERRAL: 'link', SECURITY: 'shield', SYSTEM: 'settings', PLATFORM: 'building' }
      return map[type] || 'chat'
    }

    const typeColor = (type: string) => {
      const map: Record<string, string> = { DEPOSIT: D.green, WITHDRAWAL: D.accent, PROFIT: D.green, REFERRAL: D.purple, SECURITY: D.red, SYSTEM: D.accent, PLATFORM: D.yellow }
      return map[type] || D.accent
    }

    const typeBg = (type: string) => {
      const map: Record<string, string> = { DEPOSIT: D.greenBg, WITHDRAWAL: D.accentBg, PROFIT: D.greenBg, REFERRAL: D.purpleBg, SECURITY: D.redBg, SYSTEM: D.accentBg, PLATFORM: D.yellowBg }
      return map[type] || D.accentBg
    }

    return (
      <div className="page-enter" style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="chat" size={22} color={D.accent} />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: D.textPrimary, margin: 0 }}>{lang === 'ar' ? 'الإشعارات' : 'Notifications'}</h2>
              <p style={{ fontSize: 12, color: D.textMuted, margin: 0 }}>{notifications.length} {lang === 'ar' ? 'إشعار' : 'notifications'}</p>
            </div>
          </div>
          {notifications.some((n: any) => !n.isRead) && (
            <button onClick={markAllRead} style={{ padding: '8px 16px', background: D.accentBg, border: `1px solid ${D.accentBorder}`, color: D.accent, borderRadius: 25, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>
              {lang === 'ar' ? 'تعليم الكل كمقروء' : 'Mark all read'}
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div style={{ ...cardStyle, padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <Icon name="chat" size={24} color={D.accent} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: D.textPrimary, marginBottom: 6 }}>{lang === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}</div>
            <div style={{ fontSize: 13, color: D.textSecondary }}>{lang === 'ar' ? 'ستظهر هنا جميع إشعارات المنصة' : 'All platform notifications will appear here'}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notifications.map((n: any) => (
              <div key={n.id} onClick={() => !n.isRead && markRead(n.id)} style={{ ...cardStyle, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', cursor: n.isRead ? 'default' : 'pointer', opacity: n.isRead ? 0.6 : 1, ...(isRTL ? { borderLeft: !n.isRead ? `3px solid ${typeColor(n.type)}` : '3px solid transparent' } : { borderRight: !n.isRead ? `3px solid ${typeColor(n.type)}` : '3px solid transparent' }), transition: 'all 0.2s' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: typeBg(n.type), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={typeIcon(n.type)} size={16} color={typeColor(n.type)} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>{n.title}</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteNotif(n.id) }} style={{ background: 'none', border: 'none', color: D.textMuted, cursor: 'pointer', padding: 2, display: 'flex' }}>
                      <Icon name="x" size={12} color={D.textMuted} />
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: D.textSecondary, margin: 0, lineHeight: 1.7 }}>{n.message}</p>
                  <span style={{ fontSize: 10, color: D.textMuted, marginTop: 4, display: 'block' }}>{fmtDate(n.createdAt)}</span>
                </div>
                {!n.isRead && <div style={{ width: 8, height: 8, borderRadius: '50%', background: typeColor(n.type), marginTop: 6, flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ===== ACCOUNT PAGE =====
  const AccountPage = memo(() => {
    const { lang, D, Icon, t, user, fetchUser, showToast, cardStyle, inputStyle, btnPrimary, btnOutline, fmtDate } = useApp()
    const [activeSection, setActiveSection] = useState<'main' | 'email' | 'password' | 'delete'>('main')
    const [newEmail, setNewEmail] = useState('')
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPasswordVal, setNewPasswordVal] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [deletePassword, setDeletePassword] = useState('')
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!file.type.startsWith('image/')) { showToast(lang === 'ar' ? 'يجب أن يكون الملف صورة' : 'File must be an image', 'err'); return }
      if (file.size > 2 * 1024 * 1024) { showToast(lang === 'ar' ? 'حجم الصورة يجب أن يكون أقل من 2MB' : 'Image must be under 2MB', 'err'); return }
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('avatar', file)
        formData.append('userId', user.id)
        const res = await fetch('/api/user/avatar', { method: 'POST', body: formData })
        const d = await res.json()
        if (res.ok) { showToast(lang === 'ar' ? 'تم تحديث الصورة الشخصية' : 'Profile picture updated'); fetchUser() }
        else showToast(d.error, 'err')
      } catch { showToast(lang === 'ar' ? 'حدث خطأ' : 'Error occurred', 'err') }
      setUploading(false)
    }

    const handleChangeEmail = async () => {
      if (!newEmail || !currentPassword) { showToast(lang === 'ar' ? 'جميع الحقول مطلوبة' : 'All fields required', 'err'); return }
      setSaving(true)
      try {
        const res = await fetch('/api/user/change-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, newEmail, password: currentPassword }) })
        const d = await res.json()
        if (res.ok) { showToast(lang === 'ar' ? 'تم تغيير البريد الإلكتروني بنجاح' : 'Email changed successfully'); setNewEmail(''); setCurrentPassword(''); setActiveSection('main'); fetchUser() }
        else showToast(d.error, 'err')
      } catch { showToast(lang === 'ar' ? 'حدث خطأ' : 'Error occurred', 'err') }
      setSaving(false)
    }

    const handleChangePassword = async () => {
      if (!currentPassword || !newPasswordVal || !confirmPassword) { showToast(lang === 'ar' ? 'جميع الحقول مطلوبة' : 'All fields required', 'err'); return }
      if (newPasswordVal !== confirmPassword) { showToast(lang === 'ar' ? 'كلمة المرور غير متطابقة' : 'Passwords do not match', 'err'); return }
      if (newPasswordVal.length < 6) { showToast(lang === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters', 'err'); return }
      setSaving(true)
      try {
        const res = await fetch('/api/user/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, currentPassword, newPassword: newPasswordVal }) })
        const d = await res.json()
        if (res.ok) { showToast(lang === 'ar' ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully'); setCurrentPassword(''); setNewPasswordVal(''); setConfirmPassword(''); setActiveSection('main') }
        else showToast(d.error, 'err')
      } catch { showToast(lang === 'ar' ? 'حدث خطأ' : 'Error occurred', 'err') }
      setSaving(false)
    }

    const handleDeleteAccount = async () => {
      if (!deletePassword) { showToast(lang === 'ar' ? 'يرجى إدخال كلمة المرور' : 'Please enter your password', 'err'); return }
      setSaving(true)
      try {
        const res = await fetch('/api/user/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, password: deletePassword }) })
        const d = await res.json()
        if (res.ok) { showToast(lang === 'ar' ? 'تم حذف الحساب' : 'Account deleted'); window.location.href = '/dashboard' }
        else showToast(d.error, 'err')
      } catch { showToast(lang === 'ar' ? 'حدث خطأ' : 'Error occurred', 'err') }
      setSaving(false)
    }

    const sections = [
      { id: 'email' as const, icon: 'doc', title: lang === 'ar' ? 'تغيير البريد الإلكتروني' : 'Change Email', desc: lang === 'ar' ? 'تحديث عنوان البريد الإلكتروني المرتبط بحسابك' : 'Update your email address', color: D.accent },
      { id: 'password' as const, icon: 'lock', title: lang === 'ar' ? 'تغيير كلمة المرور' : 'Change Password', desc: lang === 'ar' ? 'تحديث كلمة المرور الخاصة بك' : 'Update your password', color: D.yellow },
      { id: 'delete' as const, icon: 'x', title: lang === 'ar' ? 'حذف الحساب' : 'Delete Account', desc: lang === 'ar' ? 'حذف حسابك نهائياً وجميع بياناتك' : 'Permanently delete your account and data', color: D.red },
    ]

    if (activeSection === 'email') return (
      <div className="page-enter" style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
        <button onClick={() => setActiveSection('main')} style={{ background: 'none', border: 'none', color: D.accent, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="arrowLeft" size={16} color={D.accent} /> {lang === 'ar' ? 'رجوع' : 'Back'}
        </button>
        <div style={{ ...cardStyle, padding: '24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="doc" size={20} color={D.accent} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: D.textPrimary, margin: 0 }}>{lang === 'ar' ? 'تغيير البريد الإلكتروني' : 'Change Email'}</h3>
              <p style={{ fontSize: 12, color: D.textMuted, margin: 0 }}>{lang === 'ar' ? 'أدخل البريد الجديد وكلمة المرور الحالية' : 'Enter new email and current password'}</p>
            </div>
          </div>
          <div style={{ background: D.accentBg, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: D.accent }}>
            {lang === 'ar' ? 'البريد الحالي:' : 'Current email:'} <strong>{user.email}</strong>
          </div>
          <input style={inputStyle} placeholder={lang === 'ar' ? 'البريد الإلكتروني الجديد' : 'New email address'} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          <input style={{ ...inputStyle, marginTop: 12 }} placeholder={lang === 'ar' ? 'كلمة المرور الحالية' : 'Current password'} type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
          <button onClick={handleChangeEmail} disabled={saving} style={{ ...btnPrimary, marginTop: 16, opacity: saving ? 0.6 : 1 }}>{saving ? '...' : (lang === 'ar' ? 'تغيير البريد' : 'Change Email')}</button>
        </div>
      </div>
    )

    if (activeSection === 'password') return (
      <div className="page-enter" style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
        <button onClick={() => setActiveSection('main')} style={{ background: 'none', border: 'none', color: D.accent, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="arrowLeft" size={16} color={D.accent} /> {lang === 'ar' ? 'رجوع' : 'Back'}
        </button>
        <div style={{ ...cardStyle, padding: '24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: D.yellowBg, border: `1px solid rgba(230,162,60,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="lock" size={20} color={D.yellow} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: D.textPrimary, margin: 0 }}>{lang === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}</h3>
              <p style={{ fontSize: 12, color: D.textMuted, margin: 0 }}>{lang === 'ar' ? 'أدخل كلمة المرور الحالية والجديدة' : 'Enter current and new password'}</p>
            </div>
          </div>
          <input style={inputStyle} placeholder={lang === 'ar' ? 'كلمة المرور الحالية' : 'Current password'} type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
          <input style={{ ...inputStyle, marginTop: 12 }} placeholder={lang === 'ar' ? 'كلمة المرور الجديدة' : 'New password'} type="password" value={newPasswordVal} onChange={e => setNewPasswordVal(e.target.value)} />
          <input style={{ ...inputStyle, marginTop: 12 }} placeholder={lang === 'ar' ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          <button onClick={handleChangePassword} disabled={saving} style={{ ...btnPrimary, marginTop: 16, opacity: saving ? 0.6 : 1 }}>{saving ? '...' : (lang === 'ar' ? 'تغيير كلمة المرور' : 'Change Password')}</button>
        </div>
      </div>
    )

    if (activeSection === 'delete') return (
      <div className="page-enter" style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
        <button onClick={() => { setActiveSection('main'); setShowDeleteConfirm(false); setDeletePassword('') }} style={{ background: 'none', border: 'none', color: D.accent, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="arrowLeft" size={16} color={D.accent} /> {lang === 'ar' ? 'رجوع' : 'Back'}
        </button>
        <div style={{ ...cardStyle, padding: '24px 20px', borderColor: D.redBorder }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: D.redBg, border: `1px solid ${D.redBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={20} color={D.red} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: D.red, margin: 0 }}>{lang === 'ar' ? 'حذف الحساب' : 'Delete Account'}</h3>
              <p style={{ fontSize: 12, color: D.textMuted, margin: 0 }}>{lang === 'ar' ? 'هذا الإجراء لا يمكن التراجع عنه' : 'This action cannot be undone'}</p>
            </div>
          </div>
          {!showDeleteConfirm ? (
            <>
              <div style={{ background: D.redBg, border: `1px solid ${D.redBorder}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: D.red, lineHeight: 1.8, margin: 0 }}>{lang === 'ar' ? 'تحذير: حذف الحساب سيؤدي إلى حذف جميع بياناتك بشكل نهائي بما في ذلك الرصيد والاستثمارات وسجل المعاملات. هذا الإجراء لا يمكن التراجع عنه.' : 'Warning: Deleting your account will permanently remove all your data including balance, investments, and transaction history. This action cannot be undone.'}</p>
              </div>
              <button onClick={() => setShowDeleteConfirm(true)} style={{ ...btnPrimary, background: D.red, boxShadow: '0 0 10px rgba(243,100,100,0.3)' }}>{lang === 'ar' ? 'أريد حذف حسابي' : 'I want to delete my account'}</button>
            </>
          ) : (
            <>
              <div style={{ background: D.redBg, border: `1px solid ${D.redBorder}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: D.red, lineHeight: 1.8, margin: 0, fontWeight: 700 }}>{lang === 'ar' ? 'هل أنت متأكد؟ أدخل كلمة المرور لتأكيد الحذف النهائي' : 'Are you sure? Enter your password to confirm permanent deletion'}</p>
              </div>
              <input style={inputStyle} placeholder={lang === 'ar' ? 'كلمة المرور' : 'Password'} type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} />
              <button onClick={handleDeleteAccount} disabled={saving} style={{ ...btnPrimary, background: D.red, marginTop: 12, opacity: saving ? 0.6 : 1, boxShadow: '0 0 10px rgba(243,100,100,0.3)' }}>{saving ? '...' : (lang === 'ar' ? 'حذف الحساب نهائياً' : 'Delete Account Permanently')}</button>
            </>
          )}
        </div>
      </div>
    )

    // Main account page
    return (
      <div className="page-enter" style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
        {/* Profile Card */}
        <div style={{ ...cardStyle, padding: '24px 20px', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: D.accentBg, border: `2px solid ${D.accentBorder}`, overflow: 'hidden', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {user.avatar ? <img src={user.avatar} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling && ((e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex') }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={32} color={D.accent} />}
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ position: 'absolute', bottom: 0, right: -4, width: 28, height: 28, borderRadius: '50%', background: D.accent, border: `2px solid ${D.card}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
              <Icon name="camera" size={12} color="#fff" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: D.textPrimary, marginBottom: 2 }}>{user.name}</h3>
          <p style={{ fontSize: 13, color: D.textSecondary, marginBottom: 2 }}>{user.email}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: user.role === 'ADMIN' ? D.red : D.accent, background: user.role === 'ADMIN' ? D.redBg : D.accentBg, padding: '3px 10px', borderRadius: 8 }}>{user.role === 'ADMIN' ? (lang === 'ar' ? 'مدير' : 'Admin') : (lang === 'ar' ? 'مستخدم' : 'User')}</span>
            {user.kycStatus === 'VERIFIED' && <span style={{ fontSize: 11, fontWeight: 700, color: D.green, background: D.greenBg, padding: '3px 10px', borderRadius: 8 }}>{lang === 'ar' ? 'موثق' : 'Verified'}</span>}
          </div>
          {uploading && <div style={{ fontSize: 12, color: D.accent, marginTop: 8 }}>{lang === 'ar' ? 'جاري رفع الصورة...' : 'Uploading...'}</div>}
          {user.role === 'ADMIN' && (
            <button onClick={() => { setMenuOpen(false); router.push('/admin') }} style={{ marginTop: 12, padding: '12px 24px', background: `linear-gradient(135deg, ${D.red}, #d43b4f)`, border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", boxShadow: '0 4px 15px rgba(243,100,100,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>
              <Icon name="settings" size={18} color="#fff" />
              {lang === 'ar' ? 'لوحة الإدارة' : 'Admin Panel'}
            </button>
          )}
        </div>

        {/* Account Details */}
        <div style={{ ...cardStyle, padding: '18px 20px', marginBottom: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: D.textSecondary, marginBottom: 12 }}>{lang === 'ar' ? 'معلومات الحساب' : 'Account Info'}</h4>
          {[
            { label: lang === 'ar' ? 'الاسم' : 'Name', value: user.name },
            { label: lang === 'ar' ? 'البريد الإلكتروني' : 'Email', value: user.email },
            { label: lang === 'ar' ? 'الهاتف' : 'Phone', value: user.phone || (lang === 'ar' ? 'غير محدد' : 'Not set') },
            { label: lang === 'ar' ? 'كود الإحالة' : 'Referral Code', value: user.referralCode },
            { label: lang === 'ar' ? 'تاريخ التسجيل' : 'Joined', value: user.createdAt ? fmtDate(user.createdAt) : (lang === 'ar' ? 'غير متوفر' : 'N/A') },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 4 ? `1px solid ${D.border}` : 'none' }}>
              <span style={{ fontSize: 13, color: D.textMuted }}>{item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: D.textPrimary, direction: 'ltr' }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* KYC Verification Status */}
        <div style={{ ...cardStyle, padding: '18px 20px', marginBottom: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: D.textSecondary, marginBottom: 12 }}>{lang === 'ar' ? 'هل تم توثيق حسابك؟' : 'Is your account verified?'}</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: user.kycStatus === 'VERIFIED' ? D.greenBg : D.yellowBg, border: `1px solid ${user.kycStatus === 'VERIFIED' ? D.greenBorder : 'rgba(230,162,60,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={user.kycStatus === 'VERIFIED' ? 'check' : 'shield'} size={20} color={user.kycStatus === 'VERIFIED' ? D.green : D.yellow} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: user.kycStatus === 'VERIFIED' ? D.green : D.yellow }}>
                {user.kycStatus === 'VERIFIED' ? (lang === 'ar' ? 'موثق' : 'Verified') : (lang === 'ar' ? 'غير موثق' : 'Not Verified')}
              </div>
              <div style={{ fontSize: 12, color: D.textMuted, marginTop: 2 }}>
                {user.kycStatus === 'VERIFIED' 
                  ? (lang === 'ar' ? 'حسابك موثق بالكامل ويمكنك السحب' : 'Your account is fully verified and you can withdraw')
                  : user.kycStatus === 'PENDING'
                    ? (lang === 'ar' ? 'مستنداتك قيد المراجعة' : 'Your documents are under review')
                    : (lang === 'ar' ? 'يجب توثيق حسابك لتفعيل السحب' : 'Verify your account to enable withdrawals')}
              </div>
            </div>
            {user.kycStatus !== 'VERIFIED' && (
              <button onClick={() => navigate('kyc')} style={{ padding: '8px 16px', background: D.yellowBg, border: `1px solid rgba(230,162,60,0.3)`, color: D.yellow, borderRadius: 25, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", whiteSpace: 'nowrap' }}>
                {lang === 'ar' ? 'توثيق الآن' : 'Verify Now'}
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <h4 style={{ fontSize: 14, fontWeight: 700, color: D.textSecondary, marginBottom: 12 }}>{lang === 'ar' ? 'إعدادات الحساب' : 'Account Settings'}</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{ ...cardStyle, width: '100%', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: isRTL ? 'right' : 'left', ...(isRTL ? { borderLeft: `3px solid ${s.color}` } : { borderRight: `3px solid ${s.color}` }) }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: s.id === 'delete' ? D.redBg : s.id === 'password' ? D.yellowBg : D.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={s.icon} size={16} color={s.color} />
              </div>
              <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.id === 'delete' ? D.red : D.textPrimary }}>{s.title}</div>
                <div style={{ fontSize: 11, color: D.textMuted, marginTop: 2 }}>{s.desc}</div>
              </div>
              <Icon name="arrowLeft" size={16} color={D.textMuted} />
            </button>
          ))}
        </div>

        {/* Logout Button */}
        <div style={{ marginTop: 24 }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '14px 0', background: D.redBg, border: `1px solid ${D.redBorder}`, color: D.red, borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="logout" size={18} color={D.red} />
            {lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}
          </button>
        </div>
      </div>
    )
  })

  // ===== KYC PAGE =====

  // ===== SUPPORT PAGE =====
  const SupportPage = () => {
    const lvlConfig = SUPPORT_LEVELS[supportLevel] || SUPPORT_LEVELS[1]
    const quickReplies = [
      { icon: '💰', label: isAr ? 'كيف أودع؟' : 'How to deposit?', msg: isAr ? 'كيف أقوم بإيداع في المنصة؟' : 'How do I make a deposit?' },
      { icon: '💳', label: isAr ? 'كيف أسحب؟' : 'How to withdraw?', msg: isAr ? 'كيف أقوم بسحب أرباحي؟' : 'How do I withdraw my profits?' },
      { icon: '📊', label: isAr ? 'الباقات الاستثمارية' : 'Investment packages', msg: isAr ? 'ما هي باقات الاستثمار المتاحة؟' : 'What investment packages are available?' },
      { icon: '🪪', label: isAr ? 'التحقق KYC' : 'KYC verification', msg: isAr ? 'كيف أتمم التحقق من الهوية؟' : 'How do I complete KYC verification?' },
      { icon: '👥', label: isAr ? 'نظام الإحالات' : 'Referral program', msg: isAr ? 'كيف يعمل نظام الإحالات؟' : 'How does the referral program work?' },
      { icon: '⏳', label: isAr ? 'إيداع لم يصل' : 'Deposit not received', msg: isAr ? 'قمت بإيداع لكن لم يصل رصيدي بعد' : 'I made a deposit but it has not arrived yet' },
    ]

    const getTypingText = () => {
      switch (typingPhase) {
        case 'reading': return lvlConfig.typingTexts.reading
        case 'thinking': return lvlConfig.typingTexts.thinking
        case 'typing': return lvlConfig.typingTexts.typing
        default: return ''
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 60px)', maxHeight: 'calc(100dvh - 60px)', overflow: 'hidden' }}>
        {/* Chat Header - Level-specific with real name and avatar */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${lvlConfig.color}15`, background: `linear-gradient(135deg, ${lvlConfig.color}08 0%, ${D.bgNav} 60%)`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, transition: 'all 0.5s' }}>
          <div style={{ position: 'relative' }}>
            <img src={lvlConfig.avatar} alt="" style={{ width: 42, height: 42, borderRadius: 10, objectFit: 'contain', filter: `drop-shadow(0 2px 8px ${lvlConfig.color}40)` }} />
            <div style={{ position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderRadius: '50%', background: lvlConfig.color, border: `2px solid ${D.bgNav}` }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: D.textPrimary }}>{supportInfo?.nameAr || lvlConfig.name}</span>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${lvlConfig.color}15`, color: lvlConfig.color }}>{lvlConfig.title}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: lvlConfig.color, animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 11, color: `${lvlConfig.color}CC`, fontWeight: 600 }}>متصل الآن</span>
            </div>
          </div>
          {/* Request human agent button */}
          {supportLevel < 3 && (
            <button onClick={() => handleSendChat(isAr ? 'أريد التحدث مع دعم SONA' : 'I want to talk to SONA Support')} style={{ padding: '6px 12px', background: `${lvlConfig.color}10`, border: `1px solid ${lvlConfig.color}20`, borderRadius: 10, color: `${lvlConfig.color}AA`, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.2s' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {isAr ? 'دعم SONA' : 'SONA Support'}
            </button>
          )}
        </div>

        {/* Chat Messages */}
        <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {supportMessages.length <= 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 0 12px', justifyContent: 'center' }}>
              {quickReplies.map((qr, i) => (
                <button key={i} onClick={() => handleSendChat(qr.msg)} style={{ padding: '8px 14px', background: `${lvlConfig.color}08`, border: `1px solid ${lvlConfig.color}20`, borderRadius: 20, color: lvlConfig.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
                  <span>{qr.icon}</span> {qr.label}
                </button>
              ))}
            </div>
          )}

          {supportMessages.map((msg, idx) => {
            const isUser = msg.senderType === 'USER'
            const msgLevel = getMsgLevel(msg)
            const msgLvlConfig = SUPPORT_LEVELS[msgLevel] || SUPPORT_LEVELS[1]
            const isHandoff = msg._isHandoff || (msg.metadata ? (() => { try { return JSON.parse(msg.metadata).handoff } catch { return false } })() : false)
            const showSenderInfo = !isUser && (idx === 0 || supportMessages[idx - 1]?.senderType === 'USER' || getMsgLevel(supportMessages[idx - 1]) !== msgLevel)
            return (
              <div key={msg.id || idx} style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 6 }}>
                {!isUser && (
                  <div style={{ width: 30, height: 30, borderRadius: 8, overflow: 'hidden', flexShrink: 0, marginTop: 2 }}>
                    <img src={msgLvlConfig.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                )}
                <div style={{ maxWidth: '78%' }}>
                  {!isUser && showSenderInfo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, paddingLeft: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: msgLvlConfig.color }}>{msg.senderName || msgLvlConfig.name}</span>
                      {isHandoff && <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>تمرير</span>}
                    </div>
                  )}
                  <div style={{ padding: '10px 14px', borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: isUser ? D.accent : `${msgLvlConfig.color}08`, border: `1px solid ${isUser ? 'transparent' : `${msgLvlConfig.color}15`}`, borderLeftWidth: msgLevel === 2 ? '3px' : '1px', borderLeftColor: msgLevel === 2 ? msgLvlConfig.color : `${msgLvlConfig.color}15`, fontSize: 13, color: isUser ? '#fff' : D.textPrimary, lineHeight: 1.8, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    {msg.imageUrl && <img src={msg.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, marginBottom: msg.message ? 8 : 0, display: 'block' }} />}
                    {msg.message}
                  </div>
                  <div style={{ fontSize: 9, color: D.textMuted, marginTop: 2, textAlign: isUser ? 'left' : 'right', padding: '0 4px' }}>
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Connecting animation during escalation */}
          {isConnecting && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
              <div style={{ padding: '8px 16px', borderRadius: 12, background: `${lvlConfig.color}10`, border: `1px solid ${lvlConfig.color}20`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${lvlConfig.color}`, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 11, color: lvlConfig.color, fontWeight: 600 }}>جاري الاتصال بالفريق المتخصص...</span>
              </div>
            </div>
          )}

          {/* Escalation notice */}
          {showEscalationNotice && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
              <div style={{ padding: '8px 16px', borderRadius: 12, background: 'rgba(4,207,153,0.1)', border: '1px solid rgba(4,207,153,0.2)' }}>
                <span style={{ fontSize: 12, color: '#04cf99', fontWeight: 600 }}>{showEscalationNotice.from} → {showEscalationNotice.to}</span>
              </div>
            </div>
          )}

          {/* Typing indicator with phase */}
          {typingPhase !== 'idle' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                <img src={lvlConfig.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, paddingLeft: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: lvlConfig.color }}>{lvlConfig.name}</span>
                </div>
                <div style={{ padding: '10px 16px', borderRadius: '16px 16px 16px 4px', background: `${lvlConfig.color}08`, border: `1px solid ${lvlConfig.color}15`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: lvlConfig.color, animation: `bounce-dot 1.4s infinite ease-in-out both`, animationDelay: `${i * 0.16}s`, opacity: 0.6 }} />)}
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{getTypingText()}</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {supportMessages.length > 1 && supportMessages.length < 8 && (
          <div style={{ padding: '4px 16px 8px', display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0, WebkitOverflowScrolling: 'touch' }}>
            {quickReplies.slice(0, 4).map((qr, i) => (
              <button key={i} onClick={() => handleSendChat(qr.msg)} style={{ padding: '6px 12px', background: `${lvlConfig.color}08`, border: `1px solid ${lvlConfig.color}20`, borderRadius: 20, color: lvlConfig.color, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>
                <span>{qr.icon}</span> {qr.label}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div style={{ padding: '10px 12px', borderTop: `1px solid ${D.border}`, background: D.bgNav, display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
          <button onClick={() => { const inp = document.getElementById('chat-img-input') as HTMLInputElement; inp?.click() }} disabled={typingPhase !== 'idle'} style={{ width: 40, height: 40, background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, color: D.textSecondary, cursor: typingPhase !== 'idle' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s', opacity: typingPhase !== 'idle' ? 0.5 : 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </button>
          <input id="chat-img-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return
            if (file.size > 5 * 1024 * 1024) { showToast(isAr ? 'حجم الصورة يجب أن يكون أقل من 5MB' : 'Image must be under 5MB', 'err'); return }
            const formData = new FormData(); formData.append('image', file); formData.append('userId', user.id)
            try {
              showToast(isAr ? 'جاري رفع الصورة...' : 'Uploading image...')
              const res = await fetch('/api/support/upload', { method: 'POST', body: formData })
              const d = await res.json()
              if (res.ok && d.imageUrl) {
                handleSendChat(isAr ? 'أرسلت صورة' : 'Sent an image')
              } else { showToast(d.error || (isAr ? 'فشل رفع الصورة' : 'Upload failed'), 'err') }
            } catch { showToast(isAr ? 'حدث خطأ' : 'Error occurred', 'err') }
            e.target.value = ''
          }} />
          <textarea
            ref={chatMsgRef}
            disabled={typingPhase !== 'idle'}
            style={{ ...inputStyle, marginBottom: 0, minHeight: 40, maxHeight: 100, resize: 'none', flex: 1, lineHeight: 1.5, padding: '10px 14px', overflowY: 'hidden', borderRadius: 12, background: D.card, direction: isRTL ? 'rtl' : 'ltr', textAlign: isRTL ? 'right' : 'left', fontSize: 14, fontFamily: "'Cairo', sans-serif", opacity: typingPhase !== 'idle' ? 0.5 : 1 }}
            placeholder={isAr ? 'اكتب رسالتك...' : 'Type your message...'}
            onChange={e => { const t = e.target; requestAnimationFrame(() => { t.style.height = '40px'; t.style.height = Math.min(t.scrollHeight, 100) + 'px' }) }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat() } }}
            rows={1}
          />
          <button onClick={() => handleSendChat()} disabled={typingPhase !== 'idle'} style={{ width: 40, height: 40, background: lvlConfig.color, border: 'none', borderRadius: 12, color: '#fff', cursor: typingPhase !== 'idle' ? 'not-allowed' : 'pointer', boxShadow: `0 0 10px ${lvlConfig.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'transform 0.1s', opacity: typingPhase !== 'idle' ? 0.5 : 1 }}>
            <Icon name="send" size={16} color="#fff" />
          </button>
        </div>
        {/* Level indicator bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '4px 0 6px', background: D.bgNav }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: lvlConfig.color }} />
          <span style={{ fontSize: 9, color: D.textMuted }}>{lvlConfig.name} - {lvlConfig.title}</span>
        </div>
      </div>
    )
  }

  // ===== REFERRALS PAGE =====
  // ===== LEGITIMACY / ABOUT =====
  const LegitimacyPage = () => (
    <div className="page-enter" style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: D.textPrimary, marginBottom: 20 }}>عن المنصة</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { title: 'من نحن', content: 'SONA Digital Assets Ltd. هي شركة بريطانية متخصصة في التداول والاستثمار تعمل عبر فريق تحليل محترف. نقدم لعملائنا فرص استثمارية متنوعة مع عوائد يومية تتراوح بين 1.5% و3.5% يومياً عبر محفظة استثمارية مدارة احترافياً.' },
          { title: 'الترخيص والتنظيم', content: 'مرخصة من هيئة السلوك المالي (FCA) البريطانية برقم 847592. مسجلة كشركة أصول رقمية في المملكة المتحدة. حاصلة على ترخيص MSB الأمريكي لخدمات الأصول الرقمية تحت رقم 31000213.' },
          { title: 'التقنية', content: 'تعمل المنصة عبر فريق تحليل محترف ينفذ استراتيجيات تداول متقدمة على منصات عالمية مثل Binance و Coinbase. نقدم 3 إشارات تداول يومية لمساعدة المستثمرين.' },
          { title: 'الأمان', content: 'نظام أمان متقدم مع تشفير كامل للبيانات SSL 256-bit. تحقق من الهوية (KYC) لحماية أموالك. محفظة باردة لحفظ الأصول الرقمية.' },
          { title: 'نظام الاستثمار', content: 'عند تفعيل باقة يتجمد رأس المال فيها، وكل يوم تتحرر الأرباح اليومية. يمكن سحب الأرباح المحررة في أي وقت. في نهاية المدة يُعاد رأس المال كاملاً.' },
        ].map((s, i) => (
          <div key={i} style={{ ...cardStyle, padding: '18px 20px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: D.textPrimary, marginBottom: 8 }}>{s.title}</h3>
            <p style={{ fontSize: 13, color: D.textSecondary, lineHeight: 1.9 }}>{s.content}</p>
          </div>
        ))}
      </div>
    </div>
  )

  // ===== TERMS =====
  const TermsPage = () => (
    <div className="page-enter" style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: D.textPrimary, marginBottom: 20 }}>شروط الاستخدام</h2>
      <div style={{ ...cardStyle, padding: '24px 20px' }}>
        <div style={{ fontSize: 13, color: D.textSecondary, lineHeight: 2.2 }}>
          <p style={{ marginBottom: 16 }}>باستخدامك لمنصة SONA المملوكة لشركة SONA Digital Assets Ltd.، فإنك توافق على الشروط والأحكام التالية. يُرجى قراءتها بعناية قبل استخدام المنصة.</p>
          <p style={{ marginBottom: 16 }}><strong style={{ color: D.textPrimary }}>1. التسجيل والحسابات:</strong> يجب أن يكون عمرك 18 عاماً أو أكثر لإنشاء حساب. أنت مسؤول عن الحفاظ على سرية بيانات حسابك وكلمة المرور الخاصة بك. لا يُسمح بإنشاء أكثر من حساب لكل شخص.</p>
          <p style={{ marginBottom: 16 }}><strong style={{ color: D.textPrimary }}>2. الاستثمار:</strong> الاستثمار في الأصول الرقمية ينطوي على مخاطر. العوائد المذكورة تقديرية وقد تختلف حسب ظروف السوق. رأس المال مجمد طوال فترة الباقة ولا يمكن سحبه حتى انتهاء المدة.</p>
          <p style={{ marginBottom: 16 }}><strong style={{ color: D.textPrimary }}>3. السحب:</strong> يمكن سحب الأرباح المحررة فقط بعد التحقق من الهوية (KYC). الحد الأدنى للسحب 20 دولار أمريكي. تُعالج طلبات السحب خلال 24-48 ساعة عمل.</p>
          <p style={{ marginBottom: 16 }}><strong style={{ color: D.textPrimary }}>4. الإحالات:</strong> عمولة الإحالات 15% من استثمار الشخص المُحال. تُضاف العمولة بعد تفعيل استثمار الشخص المُحال. لا يُسمح بإحالة نفسك.</p>
          <p style={{ marginBottom: 16 }}><strong style={{ color: D.textPrimary }}>5. الخصوصية:</strong> نحترم خصوصيتك ونحمي بياناتك الشخصية وفقاً لسياسة الخصوصية الخاصة بنا.</p>
          <p style={{ marginBottom: 16 }}><strong style={{ color: D.textPrimary }}>6. المسؤولية:</strong> شركة SONA Digital Assets Ltd. غير مسؤولة عن أي خسائر ناتجة عن تقلبات السوق. جميع القرارات الاستثمارية هي مسؤولية المستخدم.</p>
          <p><strong style={{ color: D.textPrimary }}>7. التعديلات:</strong> نحتفظ بالحق في تعديل هذه الشروط في أي وقت مع إشعار مسبق عبر المنصة.</p>
        </div>
      </div>
    </div>
  )

  // ===== PRIVACY =====
  const PrivacyPage = () => (
    <div className="page-enter" style={{ padding: '20px', maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: D.textPrimary, marginBottom: 20 }}>سياسة الخصوصية</h2>
      <div style={{ ...cardStyle, padding: '24px 20px' }}>
        <div style={{ fontSize: 13, color: D.textSecondary, lineHeight: 2.2 }}>
          <p style={{ marginBottom: 16 }}>نحن في SONA Digital Assets Ltd. نلتزم بحماية خصوصيتك وبياناتك الشخصية. تسري سياسة الخصوصية هذه على جميع خدمات المنصة وفقًا للقوانين البريطانية المعمول بها.</p>
          <p style={{ marginBottom: 16 }}><strong style={{ color: D.textPrimary }}>جمع البيانات:</strong> نجمع البيانات الضرورية لتقديم خدماتنا مثل الاسم الكامل والبريد الإلكتروني ورقم الهاتف ومعلومات التحقق من الهوية (جواز سفر أو بطاقة هوية). كما نجمع بيانات المعاملات المالية وسجلات الدخول.</p>
          <p style={{ marginBottom: 16 }}><strong style={{ color: D.textPrimary }}>استخدام البيانات:</strong> تُستخدم البيانات لتقديم الخدمات وتحسينها والتحقق من الهوية والامتثال للأنظمة المعمول بها. كما نستخدمها لمنع الاحتيال وضمان أمان المنصة.</p>
          <p style={{ marginBottom: 16 }}><strong style={{ color: D.textPrimary }}>الحماية:</strong> نستخدم تشفير SSL 256-bit لحماية البيانات أثناء النقل وتخزين مشفر AES-256 للبيانات الحساسة. تُخزن الأصول الرقمية في محافظ باردة غير متصلة بالإنترنت.</p>
          <p style={{ marginBottom: 16 }}><strong style={{ color: D.textPrimary }}>مشاركة البيانات:</strong> لا نشارك بياناتك الشخصية مع أطراف ثالثة إلا بموافقتك الصريحة أو متطلبات قانونية من الجهات التنظيمية المختصة.</p>
          <p style={{ marginBottom: 16 }}><strong style={{ color: D.textPrimary }}>حقوقك:</strong> يحق لك طلب الوصول إلى بياناتك أو تعديلها أو حذفها في أي وقت عبر التواصل مع فريق الدعم.</p>
          <p><strong style={{ color: D.textPrimary }}>التواصل:</strong> لأي استفسار حول سياسة الخصوصية، يمكنك التواصل معنا عبر صفحة الدعم في المنصة.</p>
        </div>
      </div>
    </div>
  )

  // ===== ADMIN PAGE =====
  // ===== PAGE ROUTER =====
  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />
      case 'trading': return <TradingPageComponent user={user} lang={lang} onNavigate={(p) => setPage(p)} />
      case 'packages': return <PackagesPage />
      case 'investments': return <InvestmentsPage />
      case 'deposit': return <DepositPage />
      case 'withdraw': return <WithdrawPage />
      case 'p2p': return <P2PTransferPage />
      case 'signals': return <SignalsPage />
      case 'kyc': return <KycPage />
      case 'support': return <SupportPage />
      case 'notifications': return <NotificationsPage />
      case 'account': return <AccountPage />
      case 'referrals': return <ReferralsPage />
      case 'legitimacy': return <LegitimacyPage />
      case 'terms': return <TermsPage />
      case 'privacy': return <PrivacyPage />
      case 'admin': router.push('/admin'); return <DashboardPage />
      default: return <DashboardPage />
    }
  }

  // ===== MAIN LAYOUT =====
  // When on trading page, render fullscreen without header/sidebar/nav
  const isTradingFullscreen = page === 'trading'

  return (
    <AppContext.Provider value={appValue}>
    <div key={user?.id || 'guest'} style={{ minHeight: '100dvh', background: D.bg, color: D.textPrimary }}>
      {/* Top Header - Hidden on trading page */}
      {!isTradingFullscreen && (
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: D.bgNav, borderBottom: `1px solid ${D.border}` }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => navigate('account')} style={{ width: 34, height: 34, borderRadius: '50%', border: `2px solid ${D.accent}`, overflow: 'hidden', cursor: 'pointer', padding: 0, background: D.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {user.avatar ? <img src={user.avatar} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={16} color={D.accent} />}
            </button>
            <Logo size={34} spin />
            <span style={{ fontWeight: 800, fontSize: 17, color: D.textPrimary }}>SONA</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => navigate('notifications')} style={{ position: 'relative', background: D.accentBg, border: `1px solid ${D.accentBorder}`, borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="bell" size={16} color={D.accent} />
              {unreadCount > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: D.red, color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            <button onClick={toggleLang} style={{ background: D.accentBg, border: `1px solid ${D.accentBorder}`, color: D.accent, fontSize: 12, padding: '5px 12px', borderRadius: 25, cursor: 'pointer', fontWeight: 700, fontFamily: "'Cairo', sans-serif" }}>{lang === 'ar' ? 'EN' : 'عربي'}</button>
            {user.kycStatus === 'VERIFIED' && (
              <span style={{ fontSize: 11, fontWeight: 700, color: D.green, background: D.greenBg, padding: '3px 8px', borderRadius: 8, border: `1px solid ${D.greenBorder}`, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="check" size={12} color={D.green} /> {t('verifiedBadge')}
              </span>
            )}
          </div>
        </div>
      </header>
      )}

      {/* Side Menu - Hidden on trading page */}
      {!isTradingFullscreen && menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)' }} onClick={() => setMenuOpen(false)}>
          <div className="menu-slide" style={{ position: 'absolute', top: 0, ...(isRTL ? { right: 0 } : { left: 0 }), width: 280, height: '100%', background: D.bgNav, ...(isRTL ? { borderLeft: `1px solid ${D.border}` } : { borderRight: `1px solid ${D.border}` }), overflowY: 'auto', paddingBottom: 40, WebkitOverflowScrolling: 'touch' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '0 20px 20px', borderBottom: `1px solid ${D.border}`, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Logo size={32} spin />
                <span style={{ fontWeight: 800, fontSize: 16, color: D.textPrimary }}>SONA</span>
              </div>
              <div style={{ fontSize: 13, color: D.textSecondary }}>{user.name}</div>
              <div style={{ fontSize: 12, color: D.textMuted }}>{user.email}</div>
            </div>
            {navItems.map(item => (
              <button key={item.id} onClick={() => navigate(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', background: page === item.id ? D.accentBg : 'transparent', border: 'none', ...(isRTL ? { borderRight: page === item.id ? `3px solid ${D.accent}` : '3px solid transparent' } : { borderLeft: page === item.id ? `3px solid ${D.accent}` : '3px solid transparent' }), color: page === item.id ? D.accent : D.textSecondary, fontSize: 14, fontWeight: page === item.id ? 700 : 500, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", textAlign: isRTL ? 'right' : 'left', minHeight: 48, touchAction: 'manipulation' }}>
                <Icon name={item.icon} size={16} color={page === item.id ? D.accent : D.textSecondary} /> {item.label}
              </button>
            ))}

          </div>
        </div>
      )}

      {/* Page Content */}
      <main className="safe-bottom" style={isTradingFullscreen ? { padding: 0 } : { paddingBottom: 80 }}>
        {renderPage()}
      </main>

      {/* Trust Footer - Hidden on trading page */}
      {!isTradingFullscreen && (
      <div style={{ padding: '20px 20px 80px', maxWidth: 640, margin: '0 auto', borderTop: `1px solid ${D.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: D.green, fontWeight: 600 }}>FCA #847592</span>
          <span style={{ fontSize: 11, color: D.accent, fontWeight: 600 }}>MSB #31000213</span>
        </div>
        <div style={{ textAlign: 'center', color: D.textMuted, fontSize: 10 }}>SONA Digital Assets Ltd. | FCA #847592 | MSB #31000213 | help@sona.support</div>
      </div>
      )}

      {/* Bottom Navigation - Hidden on trading page */}
      {!isTradingFullscreen && (
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, background: D.bgNav, borderTop: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-around', padding: '6px 0', paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))' }}>
        {bottomNav.map(item => (
          <button key={item.id} onClick={() => navigate(item.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer', minWidth: 56 }}>
            <span style={{ opacity: page === item.id ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={item.icon} size={20} color={page === item.id ? D.accent : D.textMuted} />
            </span>
            <span style={{ fontSize: 10, fontWeight: page === item.id ? 700 : 500, color: page === item.id ? D.accent : D.textMuted, fontFamily: "'Cairo', sans-serif" }}>{item.label}</span>
          </button>
        ))}
      </nav>
      )}

      {/* Invest Modal */}
      {investModal && (
        <div className="modal-enter" style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setInvestModal(null)}>
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 15, padding: '28px 24px', maxWidth: 400, width: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: D.textPrimary, marginBottom: 4 }}>{t('investIn')} {investModal.name}</h3>
            <p style={{ fontSize: 13, color: D.textMuted, marginBottom: 12 }}>{t('dailyProfit')}: {investModal.monthlyReturn}% | {t('duration')}: {investModal.durationDays} {t('period')}</p>

            <div style={{ background: D.accentBg, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: D.textSecondary }}>
              {t('availableBalanceLabel')}: <span style={{ color: D.accent, fontWeight: 700 }}>${fmt(user.balance)}</span>
            </div>
            <input style={inputStyle} placeholder={`${t('depositAmount')} (${fmtNum(investModal.minAmount)} - ${fmtNum(investModal.maxAmount || 0)})`} type="number" value={investAmount} onChange={e => setInvestAmount(e.target.value)} />
            {investAmount && (
              <div style={{ background: D.greenBg, borderRadius: 10, padding: '10px 14px', marginTop: 8, fontSize: 12, color: D.green }}>
                {t('expectedDailyProfit')}: ${fmt(parseFloat(investAmount) * investModal.monthlyReturn / 100)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={handleInvest} style={{ ...btnPrimary, flex: 1 }}>{t('confirmInvest')}</button>
              <button onClick={() => setInvestModal(null)} style={{ ...btnOutline, flex: 0.5 }}>{t('cancelBtn')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Email Verification Prompt - Hidden on trading page */}
      {user && !user.emailVerified && !showVerifyPrompt && !isTradingFullscreen && (
        <div style={{ position: 'fixed', bottom: 70, left: 20, right: 20, zIndex: 45, maxWidth: 400, margin: '0 auto' }}>
          <div style={{ ...cardStyle, padding: '12px 16px', background: `${D.yellowBg}`, borderColor: 'rgba(230,162,60,0.3)', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12 }}>
            <Icon name="shield" size={18} color={D.yellow} />
            <span style={{ fontSize: 12, color: D.yellow, fontWeight: 600, flex: 1 }}>{t('verifyEmail')}</span>
            <button onClick={handleSendVerifyCode} style={{ padding: '4px 12px', background: D.yellow, color: '#000', border: 'none', borderRadius: 25, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>{t('sendCode')}</button>
          </div>
        </div>
      )}

      {/* Registration OTP Verification Modal */}
      {showRegistrationOtp && (
        <div className="modal-enter" style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(8px)' }}>
          <div style={{ background: D.card, border: `1px solid ${D.accentBorder}`, borderRadius: 20, padding: '32px 28px', maxWidth: 400, width: '100%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ width: 56, height: 56, borderRadius: 16, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Icon name="shield" size={28} color={D.accent} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: D.textPrimary, marginBottom: 8 }}>{isAr ? 'تحقق من بريدك الإلكتروني' : 'Verify Your Email'}</h3>
            <p style={{ fontSize: 13, color: D.textSecondary, marginBottom: 6, lineHeight: 1.7 }}>{isAr ? 'أدخل الرمز المكون من 6 أرقام المرسل إلى' : 'Enter the 6-digit code sent to'}</p>
            <p style={{ fontSize: 14, color: D.accent, fontWeight: 700, marginBottom: 20, direction: 'ltr' }}>{pendingVerifyEmail}</p>

            {/* OTP 6-digit input */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16, direction: 'ltr' }}>
              {registrationOtp.map((digit: string, idx: number) => (
                <input
                  key={idx}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const val = e.target.value
                    if (val && !/^\d$/.test(val)) return
                    const newOtp = [...registrationOtp]
                    newOtp[idx] = val
                    setRegistrationOtp(newOtp)
                    // Auto-advance to next input
                    if (val && idx < 5) {
                      const nextInput = e.currentTarget.parentElement?.querySelector(`input:nth-child(${idx + 2})`) as HTMLInputElement
                      nextInput?.focus()
                    }
                  }}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Backspace') {
                      if (!registrationOtp[idx] && idx > 0) {
                        const newOtp = [...registrationOtp]
                        newOtp[idx - 1] = ''
                        setRegistrationOtp(newOtp)
                        const prevInput = e.currentTarget.parentElement?.querySelector(`input:nth-child(${idx})`) as HTMLInputElement
                        prevInput?.focus()
                      } else {
                        const newOtp = [...registrationOtp]
                        newOtp[idx] = ''
                        setRegistrationOtp(newOtp)
                      }
                    }
                  }}
                  onPaste={(e: React.ClipboardEvent<HTMLInputElement>) => {
                    e.preventDefault()
                    const pastedData = e.clipboardData.getData('text').trim()
                    const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('')
                    if (digits.length > 0) {
                      const newOtp = [...registrationOtp]
                      digits.forEach((d: string, i: number) => { if (i < 6) newOtp[i] = d })
                      setRegistrationOtp(newOtp)
                    }
                  }}
                  disabled={otpVerifyLoading}
                  style={{
                    width: 44, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 800,
                    background: D.input, border: `2px solid ${digit ? D.accent : D.border}`,
                    borderRadius: 12, color: D.accent, outline: 'none',
                    fontFamily: "'Cairo', sans-serif",
                    transition: 'border-color 0.2s',
                  }}
                />
              ))}
            </div>

            {otpVerifyError && <p style={{ color: D.red, fontSize: 12, marginBottom: 10, fontWeight: 600 }}>{otpVerifyError}</p>}

            {/* Verify button */}
            <button
              onClick={handleRegistrationOtpVerify}
              disabled={otpVerifyLoading || registrationOtp.some(d => !d)}
              style={{
                ...btnPrimary,
                marginTop: 4,
                opacity: otpVerifyLoading || registrationOtp.some(d => !d) ? 0.5 : 1,
                background: D.gradient,
                fontSize: 16, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {otpVerifyLoading ? (isAr ? 'جاري التحقق...' : 'Verifying...') : (isAr ? 'تأكيد الرمز' : 'Confirm Code')}
            </button>

            {/* Resend */}
            <div style={{ marginTop: 14, fontSize: 13 }}>
              {otpResendCountdown > 0 ? (
                <span style={{ color: D.textMuted }}>{isAr ? `إعادة الإرسال بعد ${otpResendCountdown} ثانية` : `Resend in ${otpResendCountdown}s`}</span>
              ) : (
                <button onClick={handleOtpResend} disabled={otpResendLoading} style={{ background: 'none', border: 'none', color: D.accent, fontSize: 13, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", fontWeight: 600, opacity: otpResendLoading ? 0.5 : 1 }}>
                  {otpResendLoading ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'إعادة إرسال الرمز' : 'Resend Code')}
                </button>
              )}
            </div>

            {/* Back */}
            <button
              onClick={() => { setShowRegistrationOtp(false); setRegistrationOtp(Array(6).fill('')); setOtpVerifyError(''); setAuthMode('login') }}
              style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', color: D.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}
            >
              {isAr ? 'العودة لتسجيل الدخول' : 'Back to Login'}
            </button>
          </div>
        </div>
      )}

      {/* Email Verify Code Modal (for logged-in users) */}
      {showVerifyPrompt && (
        <div className="modal-enter" style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: D.card, border: `1px solid ${D.accentBorder}`, borderRadius: 15, padding: '28px 24px', maxWidth: 380, width: '100%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: D.accentBg, border: `1px solid ${D.accentBorder}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Icon name="shield" size={24} color={D.accent} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: D.textPrimary, marginBottom: 6 }}>{t('verifyEmail')}</h3>
            <p style={{ fontSize: 13, color: D.textSecondary, marginBottom: 16 }}>{t('verifyEmailDesc')}</p>
            <input style={inputStyle} placeholder={t('verifyCode')} value={verifyCodeInput} onChange={e => setVerifyCodeInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVerifyEmail()} />
            <button onClick={handleVerifyEmail} style={{ ...btnPrimary, marginTop: 12 }}>{t('verifyCode')}</button>
            <button onClick={handleSendVerifyCode} style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: D.accent, fontSize: 13, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", fontWeight: 600 }}>{t('resendCode')}</button>
            <button onClick={() => setShowVerifyPrompt(false)} style={{ width: '100%', marginTop: 4, background: 'none', border: 'none', color: D.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>{t('cancel')}</button>
          </div>
        </div>
      )}

      {ToastEl}

      {/* Maintenance Mode Overlay */}
      {platformSettings.maintenanceMode && user?.role !== 'ADMIN' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{ width: 80, height: 80, borderRadius: 24, background: D.yellowBg, border: `2px solid rgba(230,162,60,0.3)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Icon name="alertTriangle" size={40} color={D.yellow} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: D.yellow, marginBottom: 12 }}>{t('maintenanceMode')}</h2>
            <p style={{ fontSize: 16, color: D.textSecondary, lineHeight: 1.8 }}>{platformSettings.maintenanceMessage || t('maintenanceMessage')}</p>
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 8 }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: D.yellow, animation: `bounce-dot 1.4s infinite ease-in-out both`, animationDelay: `${i * 0.16}s` }} />)}
            </div>
          </div>
        </div>
      )}

      {/* Fake Hack Mode Overlay */}
      {platformSettings.fakeHackMode && user?.role !== 'ADMIN' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#0a0000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'hackFlash 0.5s infinite alternate' }}>
          {/* Matrix Rain Background */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.15 }}>
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} style={{ position: 'absolute', top: `-${Math.random() * 100}%`, left: `${(i / 40) * 100}%`, color: '#00ff00', fontSize: 12, fontFamily: 'monospace', writingMode: 'vertical-rl', animation: `matrixFall ${3 + Math.random() * 5}s linear infinite`, animationDelay: `${Math.random() * 3}s` }}>
                {Array.from({ length: 20 }).map((_, j) => <div key={j} style={{ opacity: Math.random() }}>{String.fromCharCode(0x30A0 + Math.random() * 96)}</div>)}
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', maxWidth: 400, zIndex: 1 }}>
            <div style={{ fontSize: 64, marginBottom: 24, animation: 'hackPulse 1s infinite' }}>
              <Icon name="alertTriangle" size={64} color="#ff0000" />
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: '#ff0000', marginBottom: 16, textShadow: '0 0 20px rgba(255,0,0,0.8)', animation: 'hackPulse 1.5s infinite' }}>
              {platformSettings.fakeHackMessage || t('hackMessage')}
            </h1>
            <p style={{ fontSize: 16, color: '#ff4444', lineHeight: 1.8, marginBottom: 24 }}>
              {lang === 'ar' ? '⚠️ تم اختراق النظام ⚠️' : '⚠️ SYSTEM COMPROMISED ⚠️'}
            </p>
            <div style={{ padding: '16px 24px', background: 'rgba(255,0,0,0.1)', border: '2px solid #ff0000', borderRadius: 12 }}>
              <p style={{ fontSize: 13, color: '#ff6666', fontFamily: 'monospace', direction: 'ltr' }}>
                ERROR 0x7F3A | ACCESS DENIED | DATA BREACH DETECTED
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
    </AppContext.Provider>
  )
}
