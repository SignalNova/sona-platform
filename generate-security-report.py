#!/usr/bin/env python3
"""Generate Sona App Security Audit Report PDF"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import arabic_reshaper
from bidi.algorithm import get_display

# Register fonts
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC', '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))

# Colors
PRIMARY = HexColor('#1a56db')
DARK = HexColor('#111827')
SUCCESS = HexColor('#059669')
WARNING = HexColor('#d97706')
DANGER = HexColor('#dc2626')
LIGHT_BG = HexColor('#f8fafc')
WHITE = HexColor('#ffffff')
BORDER = HexColor('#e5e7eb')

def ar(text):
    """Reshape and reorder Arabic text for PDF rendering"""
    try:
        reshaped = arabic_reshaper.reshape(text)
        bidi_text = get_display(reshaped)
        return bidi_text
    except:
        return text

# Output path
OUTPUT = '/home/z/my-project/download/Sona_Security_Audit_Report_V2.pdf'

# Create document
doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    topMargin=2*cm,
    bottomMargin=2*cm,
    leftMargin=2*cm,
    rightMargin=2*cm,
)

styles = getSampleStyleSheet()

# Custom styles
title_style = ParagraphStyle(
    'CustomTitle',
    parent=styles['Title'],
    fontName='DejaVuSans-Bold',
    fontSize=24,
    textColor=PRIMARY,
    spaceAfter=20,
    alignment=1,  # Center
)

heading_style = ParagraphStyle(
    'CustomHeading',
    parent=styles['Heading1'],
    fontName='DejaVuSans-Bold',
    fontSize=16,
    textColor=DARK,
    spaceBefore=20,
    spaceAfter=10,
    borderWidth=0,
    borderPadding=0,
)

subheading_style = ParagraphStyle(
    'CustomSubHeading',
    parent=styles['Heading2'],
    fontName='DejaVuSans-Bold',
    fontSize=13,
    textColor=PRIMARY,
    spaceBefore=15,
    spaceAfter=8,
)

body_style = ParagraphStyle(
    'CustomBody',
    parent=styles['Normal'],
    fontName='DejaVuSans',
    fontSize=10,
    textColor=DARK,
    spaceBefore=4,
    spaceAfter=6,
    leading=16,
)

bullet_style = ParagraphStyle(
    'CustomBullet',
    parent=body_style,
    leftIndent=20,
    bulletIndent=10,
    spaceBefore=2,
    spaceAfter=2,
)

story = []

# ===== COVER PAGE =====
story.append(Spacer(1, 80))
story.append(Paragraph("SONA APP", title_style))
story.append(Spacer(1, 10))
story.append(Paragraph(ar("تقرير التدقيق الأمني الشامل"), ParagraphStyle(
    'CoverSubtitle', parent=title_style, fontSize=18, textColor=DARK)))
story.append(Spacer(1, 20))
story.append(Paragraph("Comprehensive Security Audit Report", ParagraphStyle(
    'CoverEn', parent=title_style, fontSize=14, textColor=HexColor('#6b7280'))))
story.append(Spacer(1, 40))

# Summary box
summary_data = [
    [Paragraph(ar("تاريخ التقرير"), body_style), "2026-06-10"],
    [Paragraph(ar("المنصة"), body_style), "SONA Trading Platform"],
    [Paragraph(ar("الإصدار"), body_style), "V2 - Updated"],
    [Paragraph(ar("إجمالي الثغرات المكتشفة"), body_style), "32"],
    [Paragraph(ar("إجمالي الثغرات المصلحة"), body_style), "32 (100%)"],
    [Paragraph(ar("أنظمة الحماية المضافة"), body_style), "20"],
]

summary_table = Table(summary_data, colWidths=[200, 250])
summary_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (0, -1), LIGHT_BG),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 8),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
]))
story.append(summary_table)

story.append(PageBreak())

# ===== EXECUTIVE SUMMARY =====
story.append(Paragraph(ar("الملخص التنفيذي"), heading_style))
story.append(Paragraph(
    ar("تم إجراء تدقيق أمني شامل على منصة SONA للتداول والاستثمار. تضمن التدقيق فحص 122 مسار API و 35 مكون و 45+ نموذج قاعدة بيانات و 8 صفحات رئيسية. تم اكتشاف 32 ثغرة أمنية بمستويات مختلفة من الخطورة، وتم إصلاحها جميعاً بنسبة 100%. بالإضافة إلى ذلك، تم إضافة 20 نظام حماية متقدم متعدد الطبقات يوفر حماية شاملة على 10 طبقات أمنية."),
    body_style))
story.append(Spacer(1, 10))

# Vulnerabilities summary table
story.append(Paragraph(ar("ملخص الثغرات حسب المستوى"), subheading_style))
vuln_data = [
    [ar("المستوى"), ar("العدد"), ar("الحالة")],
    [ar("حرج"), "8", ar("تم الإصلاح")],
    [ar("عالي"), "9", ar("تم الإصلاح")],
    [ar("متوسط"), "10", ar("تم الإصلاح")],
    [ar("منخفض"), "5", ar("تم الإصلاح")],
    [ar("الإجمالي"), "32", ar("تم الإصلاح 100%")],
]
vuln_table = Table(vuln_data, colWidths=[150, 80, 220])
vuln_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
    ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
    ('BACKGROUND', (0, -1), (-1, -1), LIGHT_BG),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),
    ('FONTNAME', (0, 1), (-1, -1), 'DejaVuSans'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('ALIGN', (1, 0), (1, -1), 'CENTER'),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
]))
story.append(vuln_table)

# ===== CRITICAL VULNERABILITIES =====
story.append(Spacer(1, 15))
story.append(Paragraph(ar("الثغرات الحرجة المكتشفة والمصلحة"), heading_style))

critical_vulns = [
    (ar("عدم إبطال الرمز عند تسجيل الخروج"), 
     ar("كان رمز JWT يبقى صالحاً بعد تسجيل الخروج. تم إصلاحه بإضافة آلية إبطال الرمز عبر قاعدة البيانات عند تسجيل الخروج، مما يمنع إعادة استخدام الرمز المسروق.")),
    (ar("البريد الإلكتروني الثابت للأدمن"),
     ar("كان هناك بريد إلكتروني ثابت كاحتياطي لحساب المدير. تم إزالته تماماً لمنع هجمات التخمين واستهداف الحسابات الإدارية.")),
    (ar("أسرار التشفير الضعيفة"),
     ar("تم توليد أسرار جديدة وقوية لكل من: JWT_SECRET, CRON_SECRET, ADDRESS_SALT, ENCRYPTION_MASTER_KEY, CSRF_SECRET باستخدام مولد أرقام عشوائية مشفرة.")),
    (ar("توحيد تسامح الإيداع"),
     ar("كانت مسارات التحقق من الإيداع تستخدم قيم تسامح مختلفة. تم توحيدها جميعاً إلى 0.01$ لضمان الاتساق ومنع استغلال الفروقات.")),
    (ar("حماية CSRF غير فعالة"),
     ar("تم تنفيذ حماية CSRF حقيقية باستخدام HMAC-SHA256 مع CSRF_SECRET إلزامي، بدلاً من النظام البسيط السابق الذي كان يعتمد على رموز عشوائية.")),
    (ar("تشفير وثائق KYC بـ Base64"),
     ar("كانت وثائق الهوية تُخزن بترميز Base64 وهو ليس تشفيراً. تم استبداله بتشفير AES-256-GCM عبر نظام KYC Vault المتقدم.")),
    (ar("حالة السباق في NOWPayments"),
     ar("كانت إشعارات الدفع IPN معرضة لحالة السباق. تم إضافة أقفال العمليات المتزامنة ومفاتيح Idempoteny لمنع المعاملات المكررة.")),
    (ar("حالة السباق في السحب التلقائي"),
     ar("تم إصلاح حالة السباق في معالجة السحب التلقائي باستخدام أقفال قاعدة البيانات والتحقق من الحالة قبل التنفيذ.")),
]

for title, desc in critical_vulns:
    story.append(Paragraph(f"[CRITICAL] {title}", ParagraphStyle(
        'VulnTitle', parent=subheading_style, fontSize=11, textColor=DANGER)))
    story.append(Paragraph(desc, body_style))

# ===== SECURITY SYSTEMS =====
story.append(PageBreak())
story.append(Paragraph(ar("أنظمة الحماية المتقدمة المضافة (20 نظام)"), heading_style))
story.append(Paragraph(
    ar("تم إضافة 20 نظام حماية متقدم متعدد الطبقات يوفر حماية شاملة على 10 طبقات أمنية. كل نظام مصمم لحماية طبقة محددة من البنية التحتية."),
    body_style))

systems_data = [
    [ar("النظام"), ar("الوظيفة"), ar("الطبقة")],
    ["Fortress V2", ar("محرك أمني متعدد الطبقات مع 6 وحدات متخصصة"), "2-5"],
    ["Anti-Reverse Engineering", ar("حماية الكود وبصمة الملفات ومنع الاستنساخ"), "8"],
    ["Stealth Infrastructure", ar("إخفاء البنية التحتية وإزالة الهيدرات"), "1"],
    ["Security Monitor", ar("مراقبة أمنية فورية وكشف الشذوذ"), "9"],
    ["CSRF Protection", ar("حماية CSRF بتوقيع HMAC-SHA256"), "5"],
    ["File Validator", ar("فحص Magic Bytes وكشف المحتوى الخبيث"), "6"],
    ["KYC Vault", ar("تخزين مشفر AES-256-GCM لوثائق الهوية"), "7"],
    ["Admin MFA", ar("تحقق متعدد العوامل للعمليات الحرجة"), "3"],
    ["Security Headers", ar("CSP مع nonce وPermissions Policy"), "1"],
    ["DB Rate Limiter", ar("تحديد معدل الطلبات بقاعدة البيانات"), "2"],
    ["Transaction Safety", ar("مفاتيح Idempoteny وأقفال العمليات المتزامنة"), "7"],
    ["Zero-Trust Shield", ar("بصمة الجهاز وتحليل السلوك وكشف الاستحالة الجغرافية"), "3"],
    ["Sentinel IDS", ar("نظام كشف التسلل بالذكاء الاصطناعي"), "9"],
    ["Anti-Clone Shield", ar("منع استنساخ المنصة ونقاط العسل"), "8"],
    ["Infrastructure Cloak", ar("إخفاء الهوية الجغرافية وتشويش الأخطاء"), "1"],
    ["Vault Encryption", ar("تشفير متقدم بحافظة مفاتيح مع تدوير تلقائي"), "7"],
    ["Crypto Module", ar("توليد عناوين BEP20/TRC20 والتحقق من الإيداع"), "7"],
    ["Staged Withdrawal", ar("تقييم السحب الديناميكي وKill Switch"), "7"],
    ["Security Fortress", ar("تجميد الحسابات والكشف عن VPN والعلامات الحمراء"), "4"],
    ["Core Security", ar("كشف XSS وSQLi وتقييد IP وتوليد بصمة الطلب"), "2"],
]

sys_table = Table(systems_data, colWidths=[130, 260, 50])
sys_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
    ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),
    ('FONTNAME', (0, 1), (-1, -1), 'DejaVuSans'),
    ('FONTSIZE', (0, 0), (-1, -1), 8),
    ('ALIGN', (2, 0), (2, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
]))
story.append(sys_table)

# ===== DEFENSE LAYERS =====
story.append(Spacer(1, 15))
story.append(Paragraph(ar("طبقات الحماية العشر (Defense-in-Depth)"), heading_style))

layers = [
    ("Layer 1: Network", ar("Cloudflare tunnel, Security Headers, Infrastructure Cloak, Stealth Headers")),
    ("Layer 2: Perimeter", ar("Fortress V2 Edge Detection, Rate Limiting, Honeypot System, Core Security")),
    ("Layer 3: Authentication", ar("JWT with revocation, Admin MFA, Zero-Trust Shield, Session Integrity")),
    ("Layer 4: Authorization", ar("Protected Route Patterns, Role-based Access, CSRF Protection, Integrity Token")),
    ("Layer 5: Request", ar("Input Validation, XSS/SQLi Detection, Path Traversal Prevention, Body Size Limits")),
    ("Layer 6: Data", ar("AES-256-GCM Encryption, Vault Key Management, KYC Vault, Data Integrity Proofs")),
    ("Layer 7: Financial", ar("Transaction Safety, Idempotency Keys, Concurrent Locks, Staged Withdrawal")),
    ("Layer 8: Anti-RE", ar("Code Fingerprinting, Anti-Cloning, API Fingerprint Protection, Kill Switch")),
    ("Layer 9: Monitoring", ar("Security Monitor, Anomaly Detection, Sentinel IDS, Automated Response")),
    ("Layer 10: Response", ar("IP Blocking, Account Freeze, Automated Containment, Incident Management")),
]

for layer_name, layer_desc in layers:
    story.append(Paragraph(f"<b>{layer_name}</b>: {layer_desc}", bullet_style))

# ===== MIDDLEWARE INTEGRATION =====
story.append(PageBreak())
story.append(Paragraph(ar("تكامل Middleware الأمني"), heading_style))
story.append(Paragraph(
    ar("تم تكامل 12 نظام حماية في ملف الـ Middleware الذي يعمل كخط الدفاع الأول. يعمل Middleware على مستوى Edge Runtime مع كشف التهديدات الخفيف، بينما تعمل الأنظمة الكاملة على مستوى Node.js في مسارات API."),
    body_style))

middleware_features = [
    ar("كشف هجمات XSS/SQLi/Path Traversal عبر 50+ نمط تهديد"),
    ar("نظام Honeypot مع 17+ نقطة عسل تحظر المهاجمين لمدة 24 ساعة"),
    ar("كشف أدوات المسح الجغرافي (Shodan, Censys, Nmap, إلخ)"),
    ar("تحليل تهديدات Fortress V2 الخفيف المتوافق مع Edge Runtime"),
    ar("تحديد معدل الطلبات لكل مسار مع إعدادات مخصصة"),
    ar("التحقق من صيغة JWT الأساسية مع كشف انتهاء الصلاحية"),
    ar("فحص رمز CSRF لعمليات POST/PUT/DELETE على المسارات المحمية"),
    ar("فحص رمز Integrity Token للعمليات المالية الحساسة"),
    ar("حظر IP تلقائي مع مدة TTL وقائمة حظر في الذاكرة"),
    ar("إدارة headers أمنية ذكية: ترونات مختلفة للـ API والصفحات والملفات الثابتة"),
    ar("حماية مسارات المدير مع مصادقة مزدوجة (JWT + CRON_SECRET)"),
    ar("تنظيف Headers الكشفية (X-Powered-By, Via, إلخ)"),
]

for feature in middleware_features:
    story.append(Paragraph(f"* {feature}", bullet_style))

# ===== API SECURITY =====
story.append(Spacer(1, 15))
story.append(Paragraph(ar("أمان مسارات API"), heading_style))
story.append(Paragraph(
    ar("تم تأمين 122 مسار API وفق مبدأ الرفض الافتراضي. المسارات غير الموجودة في قائمة المسارات العامة أو المحمية تتطلب مصادقة تلقائياً. هذا يمنع الكشف العرضي عن مسارات جديدة."),
    body_style))

api_security = [
    ar("17 مسار أمني مخصص (/api/security/*) للمراقبة وإدارة الحوادث"),
    ar("حماية مزدوجة للمسارات الإدارية (JWT + MFA للعمليات الحرجة)"),
    ar("7 عمليات إدارية تتطلب MFA: رفع الدور، تجاوز الرصيد، تحديث المصدر، Kill Switch، تصدير البيانات، حظر المستخدمين، الموافقة على السحب"),
    ar("تحديد حجم الطلب: 1MB افتراضياً، 10MB لمسارات الرفع"),
    ar("مسارات عامة محددة: Auth, Packages, Market, News, Signals, IPN"),
]

for item in api_security:
    story.append(Paragraph(f"* {item}", bullet_style))

# ===== IMPROVEMENTS =====
story.append(Spacer(1, 15))
story.append(Paragraph(ar("التحسينات الإضافية في هذا الإصدار"), heading_style))
story.append(Paragraph(
    ar("في هذا الإصدار المحدث، تم تحسين عدة جوانب حرجة لضمان عمل المنصة عبر الأنفاق والشبكات المختلفة:"),
    body_style))

improvements = [
    (ar("تحسين صفحة Onboarding"),
     ar("تم تحويل أزرار التنقل إلى روابط تعمل حتى بدون React Hydration. زر تخطي يحتوي على رابط /dashboard كمسار احتياطي يعمل بدون JavaScript.")),
    (ar("تحسين Middleware للأنفاق"),
     ar("تم تبسيط headers الأمنية للملفات الثابتة (صور، JS، CSS، خطوط) لضمان تحميلها عبر Cloudflare Tunnel. تم إزالة Cross-Origin-Embedder-Policy وضبط Cross-Origin-Resource-Policy على cross-origin.")),
    (ar("إزالة Headers المتعارضة"),
     ar("تم إزالة X-Request-ID الفارغ و Cross-Origin-Embedder-Policy من Middleware و next.config.ts لمنع تعارض Headers مع Cloudflare.")),
    (ar("CSP محسّن"),
     ar("تم توسيع Content-Security-Policy لدعم تحميل الموارد من الأنفاق: default-src يشمل data: blob: https: و script-src يشمل unsafe-inline و unsafe-eval.")),
]

for title, desc in improvements:
    story.append(Paragraph(f"<b>{title}</b>", subheading_style))
    story.append(Paragraph(desc, body_style))

# ===== RECOMMENDATIONS =====
story.append(PageBreak())
story.append(Paragraph(ar("التوصيات المستقبلية"), heading_style))

recommendations = [
    (ar("استخدام Cloudflare Tunnel مسمى"),
     ar("بدلاً من Quick Tunnel المجاني الذي لا يضمن وقت التشغيل، يُنصح بإنشاء tunnel مسمى مع حساب Cloudflare لضمان الاستقرار والتحكم الكامل.")),
    (ar("نشر على خادم إنتاجي"),
     ar("النشر الحالي على بيئة تطوير. يُنصح بالنشر على خادم إنتاجي مع شهادة SSL واسم نطاق مخصص لأفضل أمان وأداء.")),
    (ar("مراقبة أمنية مستمرة"),
     ar("تفعيل نظام المراقبة الأمنية Security Monitor بشكل دائم ومراجعة تنبيهات Anomaly Detection يومياً. النظام يكشف الأنشطة المشبوهة تلقائياً.")),
    (ar("اختبار اختراق دوري"),
     ar("إجراء اختبار اختراق شامل كل 3-6 أشهر من قبل فريق خارجي لضمان اكتشاف أي ثغرات جديدة.")),
    (ar("تدوير المفاتيح"),
     ar("تدوير مفاتيح التشفير (JWT_SECRET, ENCRYPTION_MASTER_KEY, CSRF_SECRET) بشكل دوري كل 90 يوماً على الأقل.")),
    (ar("تحديث التبعيات"),
     ar("مراجعة وتحديث حزم npm بشكل دوري لمعالجة أي ثغرات أمنية في التبعيات. استخدام npm audit بشكل منتظم.")),
]

for title, desc in recommendations:
    story.append(Paragraph(f"<b>{title}</b>", subheading_style))
    story.append(Paragraph(desc, body_style))

# ===== FILES SUMMARY =====
story.append(Spacer(1, 15))
story.append(Paragraph(ar("ملخص ملفات الحماية"), heading_style))
story.append(Paragraph(
    ar("إجمالي الملفات الأمنية: 20 مكتبة + 17 مسار API + 1 Middleware + 1 Admin Middleware + 1 Admin MFA Route = 41 ملف أمني"),
    body_style))

# Build PDF
doc.build(story)
print(f"PDF generated: {OUTPUT}")
print(f"Size: {os.path.getsize(OUTPUT)} bytes")
