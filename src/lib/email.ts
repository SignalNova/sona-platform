import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// ═══════════════════════════════════════════════════════════════════
// EMAIL PROVIDER CONFIGURATION
// Primary: Resend API (works on Render - no SMTP port blocking)
// Fallback: Nodemailer SMTP (Gmail - blocked on Render but works locally)
// ═══════════════════════════════════════════════════════════════════

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'SONA Platform <onboarding@resend.dev>';

// SMTP configuration from environment (fallback)
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

// Professional sender configuration
const SENDER_DISPLAY_NAME = 'SONA Platform';
const X_MAILER_ID = 'SONA-Platform-Mailer/2.0';

// Initialize Resend client
let resendClient: Resend | null = null;
if (RESEND_API_KEY) {
  resendClient = new Resend(RESEND_API_KEY);
  console.log('[EMAIL] Resend API initialized - using as primary email provider');
} else {
  console.warn('[EMAIL] RESEND_API_KEY not set - falling back to SMTP only');
}

// Helper: build professional email headers (for SMTP)
function getProfessionalFromHeader(): string {
  return `"${SENDER_DISPLAY_NAME}" <${SMTP_USER}>`;
}

function getCommonHeaders(): Record<string, string> {
  return {
    'X-Mailer': X_MAILER_ID,
    'X-Priority': '3',
    'X-Auto-Response-Suppress': 'OOF, AutoReply',
    'Precedence': 'bulk',
  };
}

// Create a reusable transporter with proper TLS for Gmail
function createTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    family: 4,
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    rateLimit: 5,
  } as any);
}

// ═══════════════════════════════════════════════════════════════════
// CORE EMAIL SENDING - Resend first, SMTP fallback
// ═══════════════════════════════════════════════════════════════════

interface SendResult {
  success: boolean;
  error?: string;
  provider?: string;
}

async function sendViaResend(to: string, subject: string, html: string, text?: string): Promise<SendResult> {
  if (!resendClient) {
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const { data, error } = await resendClient.emails.send({
      from: RESEND_FROM_EMAIL,
      to,
      subject,
      html,
      text: text || undefined,
    });

    if (error) {
      console.error(`[EMAIL][RESEND] API error for ${to}:`, error);
      return { success: false, error: error.message, provider: 'resend' };
    }

    console.log(`[EMAIL][RESEND] Email sent successfully to ${to} (ID: ${data?.id})`);
    return { success: true, provider: 'resend' };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[EMAIL][RESEND] Failed to send to ${to}: ${message}`);
    return { success: false, error: message, provider: 'resend' };
  }
}

async function sendViaSMTP(to: string, subject: string, html: string, text?: string): Promise<SendResult> {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return { success: false, error: 'SMTP credentials not configured' };
  }

  try {
    const transporter = createTransporter();
    await transporter.verify();

    const info = await transporter.sendMail({
      from: getProfessionalFromHeader(),
      to,
      subject,
      html,
      text: text || '',
      headers: getCommonHeaders(),
    });

    console.log(`[EMAIL][SMTP] Email sent successfully to ${to} (MessageId: ${info.messageId})`);
    return { success: true, provider: 'smtp' };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[EMAIL][SMTP] Failed to send to ${to}: ${message}`);
    return { success: false, error: message, provider: 'smtp' };
  }
}

// Unified send: try Resend first, fall back to SMTP
async function sendEmailUnified(to: string, subject: string, html: string, text?: string): Promise<SendResult> {
  // Try Resend first (works on Render)
  if (resendClient) {
    const result = await sendViaResend(to, subject, html, text);
    if (result.success) return result;
    console.warn(`[EMAIL] Resend failed, falling back to SMTP...`);
  }

  // Fallback to SMTP
  const smtpResult = await sendViaSMTP(to, subject, html, text);
  if (smtpResult.success) return smtpResult;

  // Both failed
  console.error(`[EMAIL] All email providers failed for ${to}`);
  return { success: false, error: 'فشل إرسال البريد الإلكتروني - جميع الطرق فشلت' };
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API - Email sending functions
// ═══════════════════════════════════════════════════════════════════

// Send verification email (OTP code)
// CRITICAL: If email fails, returns error ONLY - never returns the verification code
export async function sendVerificationEmail(email: string, code: string, userName: string) {
  return sendEmailUnified(
    email,
    'Your SONA Verification Code',
    generateEmailHTML(code, userName),
    generateEmailText(code, userName)
  );
}

// Send a general notification email
export async function sendEmail(to: string, subject: string, html: string) {
  return sendEmailUnified(to, subject, html);
}

// ═══════════════════════════════════════════════════════════════════
// GMAIL-COMPATIBLE EMAIL TEMPLATES
// Rules: No <style> tags, no CSS gradients, no box-shadow,
// no border-radius on table cells (Gmail strips these),
// all styles inline, use bgcolor attribute where possible,
// use table layout only, avoid divs for structure
// ═══════════════════════════════════════════════════════════════════

// Plain text version of verification email - CRITICAL for Gmail deliverability
// Gmail marks HTML-only emails as suspicious/spam. Including a text part improves inbox placement.
function generateEmailText(code: string, userName: string): string {
  return `SONA Platform - Verification Code

Hello ${userName}!

Your verification code is: ${code}

This code is valid for 10 minutes only.

Enter this code in the SONA Platform app to verify your email address.

If you did not request this code, please ignore this message.
Do not share this code with anyone to protect your account.

SONA Digital Assets Platform
${new Date().getFullYear()}`;
}

function generateEmailHTML(code: string, userName: string): string {
  const year = new Date().getFullYear()
  // GMAIL-OPTIMIZED: Clean, simple HTML. No emojis (spam trigger), no divs for structure,
  // table-only layout, all inline styles, English subject (Arabic subjects trigger spam).
  // The code appears in LTR direction for easy copying on all devices.
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;padding:28px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="500" cellpadding="0" cellspacing="0" border="0" style="max-width:500px;width:100%;">

          <!-- Brand Header -->
          <tr>
            <td align="center" style="padding:0 20px 20px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#2563EB" width="48" height="48" style="color:#ffffff;font-size:22px;font-weight:800;text-align:center;border-radius:8px;">
                    S
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
                <tr>
                  <td align="center" style="font-size:20px;font-weight:800;color:#1e3a5f;letter-spacing:1px;">SONA</td>
                </tr>
                <tr>
                  <td align="center" style="font-size:11px;color:#8896a7;padding-top:2px;">Digital Assets Platform</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="padding:0 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="border:1px solid #e0e4ea;border-radius:12px;">
                <!-- Greeting -->
                <tr>
                  <td align="center" style="padding:32px 28px 8px 28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td bgcolor="#eff6ff" width="52" height="52" style="text-align:center;border-radius:10px;">
                          <span style="font-size:24px;line-height:52px;">&#128274;</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:8px 28px 0 28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                      <tr>
                        <td align="center" style="font-size:18px;font-weight:700;color:#1e293b;padding-bottom:4px;">Hello ${userName}!</td>
                      </tr>
                      <tr>
                        <td align="center" style="font-size:13px;color:#64748b;padding-bottom:20px;">Use this verification code to confirm your email address</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Code Box -->
                <tr>
                  <td align="center" style="padding:0 28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0f5ff" width="100%" style="border:2px solid #2563EB;border-radius:10px;">
                      <tr>
                        <td align="center" style="padding:20px 24px;">
                          <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;color:#2563EB;letter-spacing:8px;">${code}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Copy hint -->
                <tr>
                  <td align="center" style="padding:12px 28px 0 28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:12px;color:#64748b;">Copy this code:</td>
                      </tr>
                      <tr>
                        <td dir="ltr" align="center" style="font-family:'Courier New',Courier,monospace;font-size:18px;font-weight:700;color:#2563EB;letter-spacing:4px;padding-top:4px;">${code}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Expiry Warning -->
                <tr>
                  <td align="center" style="padding:20px 28px 0 28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="#fffbeb" width="100%" style="border:1px solid #fde68a;border-radius:8px;">
                      <tr>
                        <td align="center" style="padding:10px 14px;">
                          <span style="font-size:12px;color:#92400e;">This code expires in <strong>10 minutes</strong></span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:20px 28px 0 28px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="font-size:0;line-height:1px;" bgcolor="#e2e8f0" height="1"></td></tr>
                    </table>
                  </td>
                </tr>

                <!-- Security Tip -->
                <tr>
                  <td style="padding:16px 28px 24px 28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                      <tr>
                        <td style="font-size:12px;color:#94a3b8;line-height:1.8;">
                          <strong style="color:#64748b;">Security notice:</strong> If you did not request this code, please ignore this email. Never share this code with anyone.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 20px 0 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="font-size:12px;font-weight:700;color:#2563EB;">SONA Platform</td>
                </tr>
                <tr>
                  <td align="center" style="font-size:10px;color:#94a3b8;padding-top:3px;">&copy; ${year} SONA Digital Assets Platform. All rights reserved.</td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Send account created confirmation email
// SECURITY: No longer includes verification code in email body
export async function sendAccountCreatedEmail(email: string, userName: string) {
  return sendEmailUnified(email, 'Your SONA Account Has Been Created', generateAccountCreatedHTML(userName));
}

// Send welcome email to new users
export async function sendWelcomeEmail(email: string, userName: string) {
  return sendEmailUnified(email, 'Welcome to SONA Platform!', generateWelcomeEmailHTML(userName));
}

// Send deposit confirmation email
export async function sendDepositConfirmationEmail(
  email: string,
  userName: string,
  amount: number,
  currency: string
) {
  return sendEmailUnified(email, 'SONA Deposit Confirmed', generateDepositConfirmationHTML(userName, amount, currency));
}

// Send re-engagement email for inactive users (7+ days)
export async function sendReEngagementEmail(
  email: string,
  userName: string,
  daysInactive: number,
  lastBalance: number
) {
  return sendEmailUnified(email, 'We Miss You on SONA Platform!', generateReEngagementHTML(userName, daysInactive, lastBalance));
}

// ═══════════════════════════════════════════════════════════════════
// GMAIL-COMPATIBLE WELCOME EMAIL
// No <style> tags - all inline, table-based layout, no CSS gradients
// ═══════════════════════════════════════════════════════════════════
function generateWelcomeEmailHTML(userName: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '/';

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>مرحباً بك في SONA!</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Tahoma,Arial,sans-serif;direction:rtl;line-height:1.8;color:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:0 24px 28px 24px;">
              <div style="font-size:28px;font-weight:800;color:#2563EB;letter-spacing:1px;">SONA</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.4);margin-top:4px;">Digital Assets Platform</div>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="padding:0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d1a2e" style="border:1px solid rgba(37,99,235,0.15);">
                <!-- Greeting -->
                <tr>
                  <td align="center" style="padding:36px 32px 8px 32px;">
                    <div style="font-size:38px;margin-bottom:16px;">&#127881;</div>
                    <div style="font-size:26px;font-weight:800;color:#ffffff;">&#1605;&#1585;&#1581;&#1576;&#1575;&#1611; <span style="color:#2563EB;">${userName}</span>!</div>
                    <div style="font-size:16px;color:#22c55e;font-weight:600;margin-top:6px;">&#1578;&#1605; &#1573;&#1606;&#1588;&#1575;&#1569; &#1581;&#1587;&#1575;&#1576;&#1603; &#1576;&#1606;&#1580;&#1575;&#1581;! &#10024;</div>
                  </td>
                </tr>

                <!-- FOMO Banner -->
                <tr>
                  <td style="padding:16px 32px 0 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a1628" style="border:1px solid rgba(37,99,235,0.2);">
                      <tr>
                        <td align="center" style="padding:14px 20px;">
                          <span style="font-size:15px;color:rgba(255,255,255,0.8);font-weight:600;">&#1575;&#1606;&#1590;&#1605; &#1604;&#1613; <span style="color:#60a5fa;font-weight:800;font-size:17px;">+10,000 &#1605;&#1587;&#1578;&#1579;&#1605;&#1585;</span> &#1610;&#1581;&#1602;&#1602;&#1608;&#1606; &#1571;&#1585;&#1576;&#1575;&#1581; &#1610;&#1608;&#1605;&#1610;&#1577; &#1593;&#1604;&#1609; SONA</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Features Grid -->
                <tr>
                  <td style="padding:20px 32px 0 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="50%" style="padding:0 5px 10px 0;" valign="top">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a1628" style="border:1px solid rgba(255,255,255,0.07);">
                            <tr><td align="center" style="padding:18px 14px;">
                              <div style="font-size:28px;margin-bottom:8px;">&#128200;</div>
                              <div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:4px;">&#1576;&#1575;&#1602;&#1575;&#1578; &#1575;&#1587;&#1578;&#1579;&#1605;&#1575;&#1585;&#1610;&#1577;</div>
                              <div style="font-size:11px;color:rgba(255,255,255,0.45);">&#1593;&#1608;&#1575;&#1574;&#1583; &#1610;&#1608;&#1605;&#1610;&#1577; &#1578;&#1589;&#1604; &#1581;&#1578;&#1609; 3.5%</div>
                            </td></tr>
                          </table>
                        </td>
                        <td width="50%" style="padding:0 0 10px 5px;" valign="top">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a1628" style="border:1px solid rgba(255,255,255,0.07);">
                            <tr><td align="center" style="padding:18px 14px;">
                              <div style="font-size:28px;margin-bottom:8px;">&#128176;</div>
                              <div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:4px;">&#1571;&#1585;&#1576;&#1575;&#1581; &#1610;&#1608;&#1605;&#1610;&#1577;</div>
                              <div style="font-size:11px;color:rgba(255,255,255,0.45);">&#1587;&#1581;&#1576; &#1571;&#1585;&#1576;&#1575;&#1581;&#1603; &#1601;&#1610; &#1571;&#1610; &#1608;&#1602;&#1578;</div>
                            </td></tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding:0 5px 10px 0;" valign="top">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a1628" style="border:1px solid rgba(255,255,255,0.07);">
                            <tr><td align="center" style="padding:18px 14px;">
                              <div style="font-size:28px;margin-bottom:8px;">&#127873;</div>
                              <div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:4px;">&#1593;&#1605;&#1608;&#1604;&#1575;&#1578; &#1575;&#1604;&#1573;&#1581;&#1575;&#1604;&#1577;</div>
                              <div style="font-size:11px;color:rgba(255,255,255,0.45);">15% &#1593;&#1605;&#1608;&#1604;&#1577; &#1605;&#1606; &#1603;&#1604; &#1573;&#1581;&#1575;&#1604;&#1577;</div>
                            </td></tr>
                          </table>
                        </td>
                        <td width="50%" style="padding:0 0 10px 5px;" valign="top">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a1628" style="border:1px solid rgba(255,255,255,0.07);">
                            <tr><td align="center" style="padding:18px 14px;">
                              <div style="font-size:28px;margin-bottom:8px;">&#9889;</div>
                              <div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:4px;">&#1573;&#1588;&#1575;&#1585;&#1575;&#1578; &#1581;&#1589;&#1585;&#1610;&#1577;</div>
                              <div style="font-size:11px;color:rgba(255,255,255,0.45);">3 &#1571;&#1607;&#1583;&#1575;&#1601; &#1604;&#1603;&#1604; &#1573;&#1588;&#1575;&#1585;&#1577; &#1578;&#1583;&#1575;&#1608;&#1604;</div>
                            </td></tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td align="center" style="padding:8px 32px 24px 32px;">
                    <a href="${appUrl}" style="display:inline-block;background-color:#2563EB;color:#ffffff;font-family:Tahoma,Arial,sans-serif;font-size:18px;font-weight:700;padding:16px 56px;text-decoration:none;letter-spacing:0.5px;">&#128640; &#1575;&#1576;&#1583;&#1571; &#1575;&#1604;&#1575;&#1587;&#1578;&#1579;&#1605;&#1575;&#1585; &#1575;&#1604;&#1570;&#1606;</a>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:0 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="font-size:0;line-height:1px;" bgcolor="rgba(255,255,255,0.06)" height="1">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>

                <!-- How to start -->
                <tr>
                  <td style="padding:20px 32px 0 32px;">
                    <div style="font-size:16px;font-weight:700;color:#ffffff;margin-bottom:16px;">&#128218; &#1603;&#1610;&#1601; &#1578;&#1576;&#1583;&#1571;&#1567;</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <!-- Step 1 -->
                      <tr>
                        <td width="36" valign="top" style="padding:0 0 14px 0;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr><td align="center" bgcolor="#0a1628" width="32" height="32" style="border:1px solid rgba(37,99,235,0.3);color:#2563EB;font-weight:800;font-size:14px;text-align:center;">1</td></tr>
                          </table>
                        </td>
                        <td style="padding:0 0 14px 12px;font-size:14px;color:rgba(255,255,255,0.7);">
                          <strong style="color:#ffffff;">&#1601;&#1593;&#1617;&#1604; &#1576;&#1585;&#1610;&#1583;&#1603; &#1575;&#1604;&#1573;&#1604;&#1603;&#1578;&#1585;&#1608;&#1606;&#1610;</strong> &#8212; &#1571;&#1583;&#1582;&#1604; &#1585;&#1605;&#1586; &#1575;&#1604;&#1578;&#1581;&#1602;&#1602; &#1575;&#1604;&#1584;&#1610; &#1571;&#1585;&#1587;&#1604;&#1606;&#1575;&#1607; &#1604;&#1576;&#1585;&#1610;&#1583;&#1603;
                        </td>
                      </tr>
                      <!-- Step 2 -->
                      <tr>
                        <td width="36" valign="top" style="padding:0 0 14px 0;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr><td align="center" bgcolor="#0a1628" width="32" height="32" style="border:1px solid rgba(37,99,235,0.3);color:#2563EB;font-weight:800;font-size:14px;text-align:center;">2</td></tr>
                          </table>
                        </td>
                        <td style="padding:0 0 14px 12px;font-size:14px;color:rgba(255,255,255,0.7);">
                          <strong style="color:#ffffff;">&#1571;&#1608;&#1583;&#1593; USDT</strong> &#8212; &#1571;&#1590;&#1601; &#1585;&#1589;&#1610;&#1583;&#1603; &#1608;&#1575;&#1582;&#1578;&#1585; &#1575;&#1604;&#1576;&#1575;&#1602;&#1577; &#1575;&#1604;&#1605;&#1606;&#1575;&#1587;&#1576;&#1577; &#1604;&#1603;
                        </td>
                      </tr>
                      <!-- Step 3 -->
                      <tr>
                        <td width="36" valign="top" style="padding:0 0 14px 0;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr><td align="center" bgcolor="#0a1628" width="32" height="32" style="border:1px solid rgba(37,99,235,0.3);color:#2563EB;font-weight:800;font-size:14px;text-align:center;">3</td></tr>
                          </table>
                        </td>
                        <td style="padding:0 0 14px 12px;font-size:14px;color:rgba(255,255,255,0.7);">
                          <strong style="color:#ffffff;">&#1575;&#1576;&#1583;&#1571; &#1576;&#1578;&#1581;&#1602;&#1610;&#1602; &#1575;&#1604;&#1571;&#1585;&#1576;&#1575;&#1581;</strong> &#8212; &#1578;&#1575;&#1576;&#1593; &#1571;&#1585;&#1576;&#1575;&#1581;&#1603; &#1575;&#1604;&#1610;&#1608;&#1605;&#1610;&#1577; &#1608;&#1575;&#1587;&#1581;&#1576;&#1607;&#1575; &#1608;&#1602;&#1578;&#1605;&#1575; &#1578;&#1585;&#1610;&#1583;
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Profit Example -->
                <tr>
                  <td style="padding:20px 32px 0 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#051510" style="border:1px solid rgba(34,197,94,0.15);">
                      <tr>
                        <td align="center" style="padding:20px;">
                          <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:8px;">&#128178; &#1605;&#1579;&#1575;&#1604; &#1593;&#1604;&#1609; &#1575;&#1604;&#1571;&#1585;&#1576;&#1575;&#1581; &#1575;&#1604;&#1610;&#1608;&#1605;&#1610;&#1577;</div>
                          <div style="font-size:14px;color:rgba(255,255,255,0.7);direction:ltr;">
                            &#1575;&#1587;&#1578;&#1579;&#1605;&#1585; <span style="color:#ffffff;font-weight:700;">$500</span> = &#1575;&#1585;&#1576;&#1581; &#1610;&#1608;&#1605;&#1610;&#1575;&#1611; <span style="color:#22c55e;font-weight:800;font-size:22px;">$17.5</span>
                          </div>
                          <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:8px;">*&#1581;&#1587;&#1576; &#1576;&#1575;&#1602;&#1577; &#1575;&#1604;&#1593;&#1608;&#1575;&#1574;&#1583; &#1575;&#1604;&#1605;&#1582;&#1578;&#1575;&#1585;&#1577;</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Tip -->
                <tr>
                  <td style="padding:20px 32px 32px 32px;">
                    <div style="font-size:13px;color:rgba(255,255,255,0.3);line-height:1.9;">
                      <strong style="color:rgba(255,255,255,0.5);">&#1606;&#1589;&#1610;&#1581;&#1577;:</strong> &#1578;&#1581;&#1602;&#1602; &#1605;&#1606; &#1576;&#1585;&#1610;&#1583;&#1603; &#1575;&#1604;&#1573;&#1604;&#1603;&#1578;&#1585;&#1608;&#1606;&#1610; &#1604;&#1578;&#1601;&#1593;&#1610;&#1604; &#1581;&#1587;&#1575;&#1576;&#1603; &#1608;&#1575;&#1604;&#1576;&#1583;&#1569; &#1601;&#1610; &#1575;&#1604;&#1575;&#1587;&#1578;&#1579;&#1605;&#1575;&#1585;.<br/>
                      &#1601;&#1585;&#1610;&#1602; &#1575;&#1604;&#1583;&#1593;&#1605; &#1605;&#1578;&#1575;&#1581; &#1604;&#1605;&#1587;&#1575;&#1593;&#1583;&#1578;&#1603; &#1593;&#1604;&#1609; &#1605;&#1583;&#1575;&#1585; &#1575;&#1604;&#1587;&#1575;&#1593;&#1577;.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 24px 0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="font-size:0;line-height:1px;" bgcolor="rgba(255,255,255,0.06)" height="1">&nbsp;</td></tr>
              </table>
              <div style="font-size:14px;font-weight:700;color:#2563EB;margin-top:16px;margin-bottom:4px;">SONA Platform</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.2);">&copy; ${new Date().getFullYear()} SONA Digital Assets Platform. &#1580;&#1605;&#1610;&#1593; &#1575;&#1604;&#1581;&#1602;&#1608;&#1602; &#1605;&#1581;&#1601;&#1608;&#1592;&#1577;.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════
// GMAIL-COMPATIBLE ACCOUNT CREATED EMAIL
// SECURITY FIX: No verification code included in this email
// ═══════════════════════════════════════════════════════════════════
function generateAccountCreatedHTML(userName: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '/';

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تم إنشاء حسابك - SONA Platform</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Tahoma,Arial,sans-serif;direction:rtl;line-height:1.8;color:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:0 24px 28px 24px;">
              <div style="font-size:28px;font-weight:800;color:#2563EB;letter-spacing:1px;">SONA</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.4);margin-top:4px;">Digital Assets Platform</div>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="padding:0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d1a2e" style="border:1px solid rgba(37,99,235,0.15);">
                <!-- Icon & Greeting -->
                <tr>
                  <td align="center" style="padding:36px 32px 8px 32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr><td align="center" bgcolor="#051510" width="72" height="72" style="text-align:center;"><span style="font-size:36px;color:#22c55e;line-height:72px;">&#10003;</span></td></tr>
                    </table>
                    <div style="font-size:22px;font-weight:700;color:#ffffff;margin-top:20px;">&#1605;&#1585;&#1581;&#1576;&#1575;&#1611; ${userName}!</div>
                    <div style="font-size:16px;color:#22c55e;font-weight:600;margin-top:6px;">&#1578;&#1605; &#1573;&#1606;&#1588;&#1575;&#1569; &#1581;&#1587;&#1575;&#1576;&#1603; &#1576;&#1606;&#1580;&#1575;&#1581;</div>
                  </td>
                </tr>

                <!-- Info Box -->
                <tr>
                  <td style="padding:16px 32px 0 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a1628" style="border:1px solid rgba(255,255,255,0.08);">
                      <tr>
                        <td style="padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">
                          <span style="color:rgba(255,255,255,0.4);font-size:13px;">&#1575;&#1604;&#1581;&#1575;&#1604;&#1577;</span>
                          <span style="color:#22c55e;font-weight:600;font-size:13px;float:left;">&#10003; &#1606;&#1588;&#1591; - &#1576;&#1575;&#1606;&#1578;&#1592;&#1575;&#1585; &#1578;&#1601;&#1593;&#1610;&#1604; &#1575;&#1604;&#1576;&#1585;&#1610;&#1583;</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 16px;">
                          <span style="color:rgba(255,255,255,0.4);font-size:13px;">&#1575;&#1604;&#1582;&#1591;&#1608;&#1577; &#1575;&#1604;&#1578;&#1575;&#1604;&#1610;&#1577;</span>
                          <span style="color:#ffffff;font-weight:600;font-size:13px;float:left;">&#128274; &#1578;&#1601;&#1593;&#1610;&#1604; &#1575;&#1604;&#1576;&#1585;&#1610;&#1583; &#1575;&#1604;&#1573;&#1604;&#1603;&#1578;&#1585;&#1608;&#1606;&#1610;</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Steps -->
                <tr>
                  <td style="padding:20px 32px 0 32px;">
                    <div style="font-size:15px;font-weight:700;color:rgba(255,255,255,0.8);margin-bottom:16px;">&#128220; &#1582;&#1591;&#1608;&#1575;&#1578;&#1603; &#1575;&#1604;&#1578;&#1575;&#1604;&#1610;&#1577;</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="36" valign="top" style="padding:0 0 14px 0;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr><td align="center" bgcolor="#0a1628" width="32" height="32" style="border:1.5px solid rgba(37,99,235,0.4);color:#2563EB;font-weight:700;font-size:13px;text-align:center;">1</td></tr>
                          </table>
                        </td>
                        <td style="padding:0 0 14px 12px;font-size:14px;color:rgba(255,255,255,0.7);">
                          <strong style="color:#ffffff;">&#1578;&#1601;&#1593;&#1610;&#1604; &#1575;&#1604;&#1576;&#1585;&#1610;&#1583; &#1575;&#1604;&#1573;&#1604;&#1603;&#1578;&#1585;&#1608;&#1606;&#1610;</strong> &#8212; &#1575;&#1606;&#1587;&#1582; &#1575;&#1604;&#1585;&#1605;&#1586; &#1605;&#1606; &#1576;&#1585;&#1610;&#1583;&#1603; &#1608;&#1571;&#1583;&#1582;&#1604;&#1607; &#1601;&#1610; &#1575;&#1604;&#1605;&#1606;&#1589;&#1577;
                          <div style="font-size:11px;font-weight:600;color:#f59e0b;margin-top:2px;">&#9679; &#1605;&#1591;&#1604;&#1608;&#1576; &#1575;&#1604;&#1570;&#1606;</div>
                        </td>
                      </tr>
                      <tr>
                        <td width="36" valign="top" style="padding:0 0 14px 0;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr><td align="center" bgcolor="#0a1628" width="32" height="32" style="border:1.5px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.3);font-weight:700;font-size:13px;text-align:center;">2</td></tr>
                          </table>
                        </td>
                        <td style="padding:0 0 14px 12px;font-size:14px;color:rgba(255,255,255,0.7);">
                          <strong style="color:#ffffff;">&#1571;&#1608;&#1583;&#1593; USDT</strong> &#8212; &#1571;&#1590;&#1601; &#1585;&#1589;&#1610;&#1583;&#1603; &#1604;&#1604;&#1576;&#1583;&#1569; &#1576;&#1575;&#1604;&#1575;&#1587;&#1578;&#1579;&#1605;&#1575;&#1585;
                          <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.3);margin-top:2px;">&#9679; &#1575;&#1604;&#1582;&#1591;&#1608;&#1577; &#1575;&#1604;&#1578;&#1575;&#1604;&#1610;&#1577;</div>
                        </td>
                      </tr>
                      <tr>
                        <td width="36" valign="top" style="padding:0 0 14px 0;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr><td align="center" bgcolor="#0a1628" width="32" height="32" style="border:1.5px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.3);font-weight:700;font-size:13px;text-align:center;">3</td></tr>
                          </table>
                        </td>
                        <td style="padding:0 0 14px 12px;font-size:14px;color:rgba(255,255,255,0.7);">
                          <strong style="color:#ffffff;">&#1575;&#1582;&#1578;&#1585; &#1576;&#1575;&#1602;&#1577; &#1575;&#1587;&#1578;&#1579;&#1605;&#1575;&#1585;&#1610;&#1577;</strong> &#8212; &#1608;&#1575;&#1581;&#1589;&#1604; &#1593;&#1604;&#1609; &#1571;&#1585;&#1576;&#1575;&#1581; &#1610;&#1608;&#1605;&#1610;&#1577;!
                          <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.3);margin-top:2px;">&#9679; &#1575;&#1604;&#1582;&#1591;&#1608;&#1577; &#1575;&#1604;&#1578;&#1575;&#1604;&#1610;&#1577;</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td align="center" style="padding:8px 32px 24px 32px;">
                    <a href="${appUrl}" style="display:inline-block;background-color:#2563EB;color:#ffffff;font-family:Tahoma,Arial,sans-serif;font-size:17px;font-weight:700;padding:14px 48px;text-decoration:none;">&#128640; &#1575;&#1583;&#1582;&#1604; &#1604;&#1605;&#1606;&#1589;&#1577; SONA</a>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:0 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="font-size:0;line-height:1px;" bgcolor="rgba(255,255,255,0.06)" height="1">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>

                <!-- Tip -->
                <tr>
                  <td style="padding:20px 32px 32px 32px;">
                    <div style="font-size:13px;color:rgba(255,255,255,0.3);line-height:1.9;">
                      <strong style="color:rgba(255,255,255,0.5);">&#1605;&#1604;&#1575;&#1581;&#1592;&#1577;:</strong> &#1604;&#1575;&#1586;&#1605; &#1578;&#1601;&#1593;&#1604; &#1576;&#1585;&#1610;&#1583;&#1603; &#1575;&#1604;&#1573;&#1604;&#1603;&#1578;&#1585;&#1608;&#1606;&#1610; &#1602;&#1576;&#1604; &#1605;&#1575; &#1578;&#1602;&#1583;&#1585; &#1578;&#1587;&#1578;&#1582;&#1583;&#1605; &#1575;&#1604;&#1605;&#1606;&#1589;&#1577;.<br/>
                      &#1601;&#1585;&#1610;&#1602; &#1575;&#1604;&#1583;&#1593;&#1605; &#1605;&#1578;&#1575;&#1581; &#1604;&#1605;&#1587;&#1575;&#1593;&#1583;&#1578;&#1603; &#1593;&#1604;&#1609; &#1605;&#1583;&#1575;&#1585; &#1575;&#1604;&#1587;&#1575;&#1593;&#1577;.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 24px 0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="font-size:0;line-height:1px;" bgcolor="rgba(255,255,255,0.06)" height="1">&nbsp;</td></tr>
              </table>
              <div style="font-size:14px;font-weight:700;color:#2563EB;margin-top:16px;margin-bottom:4px;">SONA Platform</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.2);">&copy; ${new Date().getFullYear()} SONA - &#1580;&#1605;&#1610;&#1593; &#1575;&#1604;&#1581;&#1602;&#1608;&#1602; &#1605;&#1581;&#1601;&#1608;&#1592;&#1577;.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generateReEngagementHTML(userName: string, daysInactive: number, lastBalance: number): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '/';
  const formattedBalance = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(lastBalance);

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>وحشتنا! - SONA Platform</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Tahoma,Arial,sans-serif;direction:rtl;line-height:1.8;color:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:0 24px 28px 24px;">
              <div style="font-size:28px;font-weight:800;color:#2563EB;letter-spacing:1px;">SONA</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.4);margin-top:4px;">Digital Assets Platform</div>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="padding:0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d1a2e" style="border:1px solid rgba(37,99,235,0.15);">
                <!-- Icon & Greeting -->
                <tr>
                  <td align="center" style="padding:36px 32px 8px 32px;">
                    <div style="font-size:38px;margin-bottom:16px;">&#128140;</div>
                    <div style="font-size:24px;font-weight:800;color:#ffffff;">&#1608;&#1581;&#1588;&#1578;&#1606;&#1575; &#1610;&#1575; <span style="color:#2563EB;">${userName}</span>!</div>
                    <div style="font-size:16px;color:rgba(255,255,255,0.6);margin-top:8px;line-height:1.9;">
                      &#1605;&#1575; &#1588;&#1601;&#1606;&#1575;&#1603; &#1605;&#1606; <span style="color:#f59e0b;font-weight:700;">${daysInactive} &#1610;&#1608;&#1605;</span>! &#1581;&#1587;&#1575;&#1576;&#1603; &#1608;&#1571;&#1585;&#1576;&#1575;&#1581;&#1603; &#1604;&#1587;&#1575; &#1593;&#1605; &#1578;&#1587;&#1578;&#1606;&#1575;&#1603;.<br/>
                      &#1575;&#1604;&#1587;&#1608;&#1602; &#1605;&#1575; &#1576;&#1587;&#1578;&#1606;&#1609; &#1581;&#1583;&#1575;&#1548; &#1608;&#1575;&#1604;&#1601;&#1585;&#1589; &#1576;&#1578;&#1585;&#1608;&#1581; &#1576;&#1587;&#1585;&#1593;&#1577;!
                    </div>
                  </td>
                </tr>

                <!-- Balance Box -->
                <tr>
                  <td style="padding:20px 32px 0 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a1628" style="border:1px solid rgba(37,99,235,0.2);direction:ltr;">
                      <tr>
                        <td align="center" style="padding:24px;">
                          <div style="font-size:13px;color:rgba(255,255,255,0.4);margin-bottom:8px;direction:rtl;">&#128176; &#1585;&#1589;&#1610;&#1583;&#1603; &#1575;&#1604;&#1581;&#1575;&#1604;&#1610;</div>
                          <span style="font-size:34px;font-weight:800;color:#2563EB;">${formattedBalance}</span>
                          <span style="font-size:16px;font-weight:500;color:rgba(255,255,255,0.5);margin-left:8px;">USDT</span>
                          <div style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:8px;direction:rtl;">&#1585;&#1589;&#1610;&#1583;&#1603; &#1604;&#1587;&#1575; &#1605;&#1608;&#1580;&#1608;&#1583; &#1608;&#1570;&#1605;&#1606; &#8212; &#1576;&#1587; &#1604;&#1575;&#1586;&#1605; &#1578;&#1588;&#1578;&#1594;&#1604; &#1593;&#1604;&#1610;&#1607;!</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Opportunity Box -->
                <tr>
                  <td style="padding:20px 32px 0 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#051510" style="border:1px solid rgba(34,197,94,0.15);">
                      <tr>
                        <td style="padding:18px 20px;">
                          <div style="font-size:15px;color:#22c55e;font-weight:700;margin-bottom:6px;">&#128200; &#1601;&#1585;&#1589; &#1605;&#1575; &#1576;&#1578;&#1606;&#1578;&#1592;&#1585;!</div>
                          <div style="font-size:14px;color:rgba(255,255,255,0.7);line-height:1.9;">
                            &#1575;&#1604;&#1605;&#1587;&#1578;&#1579;&#1605;&#1585;&#1610;&#1606; &#1575;&#1604;&#1606;&#1588;&#1591;&#1610;&#1606; &#1593;&#1604;&#1609; SONA &#1593;&#1605; &#1610;&#1581;&#1602;&#1602;&#1608;&#1575; &#1571;&#1585;&#1576;&#1575;&#1581; &#1610;&#1608;&#1605;&#1610;&#1577; &#1581;&#1602;&#1610;&#1602;&#1610;&#1577;.<br/>
                            &#1571;&#1585;&#1576;&#1575;&#1581;&#1603; &#1605;&#1605;&#1603;&#1606; &#1578;&#1603;&#1576;&#1585; &#1603;&#1604; &#1610;&#1608;&#1605; &#1573;&#1584;&#1575; &#1585;&#1580;&#1593;&#1578; &#1608;&#1575;&#1587;&#1578;&#1579;&#1605;&#1585;&#1578; <span style="color:#22c55e;font-weight:700;">&#1575;&#1604;&#1570;&#1606;</span>!
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td align="center" style="padding:20px 32px 24px 32px;">
                    <a href="${appUrl}" style="display:inline-block;background-color:#2563EB;color:#ffffff;font-family:Tahoma,Arial,sans-serif;font-size:18px;font-weight:700;padding:16px 56px;text-decoration:none;">&#128640; &#1585;&#1580;&#1593; &#1604;&#1605;&#1606;&#1589;&#1577; SONA</a>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:0 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="font-size:0;line-height:1px;" bgcolor="rgba(255,255,255,0.06)" height="1">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>

                <!-- Tip -->
                <tr>
                  <td style="padding:20px 32px 32px 32px;">
                    <div style="font-size:13px;color:rgba(255,255,255,0.3);line-height:1.9;">
                      <strong style="color:rgba(255,255,255,0.5);">&#1605;&#1604;&#1575;&#1581;&#1592;&#1577;:</strong> &#1581;&#1587;&#1575;&#1576;&#1603; &#1570;&#1605;&#1606; &#1608;&#1605;&#1581;&#1605;&#1610;. &#1573;&#1584;&#1575; &#1605;&#1575; &#1576;&#1583;&#1603; &#1578;&#1578;&#1604;&#1602;&#1609; &#1607;&#1575;&#1604;&#1585;&#1587;&#1575;&#1574;&#1604; &#1605;&#1585;&#1577; &#1578;&#1575;&#1606;&#1610;&#1577;&#1548; &#1578;&#1580;&#1575;&#1607;&#1604;&#1607;&#1575;.<br/>
                      &#1601;&#1585;&#1610;&#1602; &#1575;&#1604;&#1583;&#1593;&#1605; &#1605;&#1578;&#1575;&#1581; &#1604;&#1605;&#1587;&#1575;&#1593;&#1583;&#1578;&#1603; &#1593;&#1604;&#1609; &#1605;&#1583;&#1575;&#1585; &#1575;&#1604;&#1587;&#1575;&#1593;&#1577;.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 24px 0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="font-size:0;line-height:1px;" bgcolor="rgba(255,255,255,0.06)" height="1">&nbsp;</td></tr>
              </table>
              <div style="font-size:14px;font-weight:700;color:#2563EB;margin-top:16px;margin-bottom:4px;">SONA Platform</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.2);">&copy; ${new Date().getFullYear()} SONA Digital Assets Platform. &#1580;&#1605;&#1610;&#1593; &#1575;&#1604;&#1581;&#1602;&#1608;&#1602; &#1605;&#1581;&#1601;&#1608;&#1592;&#1577;.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generateDepositConfirmationHTML(userName: string, amount: number, currency: string): string {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تأكيد الإيداع - SONA Platform</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Tahoma,Arial,sans-serif;direction:rtl;line-height:1.8;color:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:0 24px 28px 24px;">
              <div style="font-size:28px;font-weight:800;color:#2563EB;letter-spacing:1px;">SONA</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.4);margin-top:4px;">Digital Assets Platform</div>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="padding:0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d1a2e" style="border:1px solid rgba(37,99,235,0.15);">
                <tr>
                  <td align="center" style="padding:36px 32px 8px 32px;">
                    <div style="font-size:38px;margin-bottom:16px;">&#128176;</div>
                    <div style="font-size:22px;font-weight:700;color:#ffffff;">&#1578;&#1571;&#1603;&#1610;&#1583; &#1575;&#1604;&#1573;&#1610;&#1583;&#1575;&#1593;</div>
                    <div style="font-size:16px;color:#22c55e;font-weight:600;margin-top:6px;">&#1578;&#1605; &#1573;&#1610;&#1583;&#1575;&#1593; &#1575;&#1604;&#1605;&#1576;&#1604;&#1594; &#1576;&#1606;&#1580;&#1575;&#1581;!</div>
                  </td>
                </tr>

                <!-- Amount Box -->
                <tr>
                  <td style="padding:20px 32px 0 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a1628" style="border:1px solid rgba(34,197,94,0.2);direction:ltr;">
                      <tr>
                        <td align="center" style="padding:24px;">
                          <div style="font-size:13px;color:rgba(255,255,255,0.4);margin-bottom:8px;direction:rtl;">&#1575;&#1604;&#1605;&#1576;&#1604;&#1594; &#1575;&#1604;&#1605;&#1573;&#1583;&#1593;</div>
                          <span style="font-size:34px;font-weight:800;color:#22c55e;">${formattedAmount}</span>
                          <span style="font-size:16px;font-weight:500;color:rgba(255,255,255,0.5);margin-left:8px;">${currency}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Tip -->
                <tr>
                  <td style="padding:24px 32px 32px 32px;">
                    <div style="font-size:13px;color:rgba(255,255,255,0.3);line-height:1.9;">
                      <strong style="color:rgba(255,255,255,0.5);">&#1605;&#1604;&#1575;&#1581;&#1592;&#1577;:</strong> &#1585;&#1589;&#1610;&#1583;&#1603; &#1578;&#1605; &#1578;&#1581;&#1583;&#1610;&#1579;&#1607;. &#1610;&#1605;&#1603;&#1606;&#1603; &#1575;&#1604;&#1570;&#1606; &#1575;&#1582;&#1578;&#1610;&#1575;&#1585; &#1576;&#1575;&#1602;&#1577; &#1575;&#1587;&#1578;&#1579;&#1605;&#1575;&#1585;&#1610;&#1577; &#1608;&#1575;&#1604;&#1576;&#1583;&#1569; &#1576;&#1578;&#1581;&#1602;&#1610;&#1602; &#1575;&#1604;&#1571;&#1585;&#1576;&#1575;&#1581;.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 24px 0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="font-size:0;line-height:1px;" bgcolor="rgba(255,255,255,0.06)" height="1">&nbsp;</td></tr>
              </table>
              <div style="font-size:14px;font-weight:700;color:#2563EB;margin-top:16px;margin-bottom:4px;">SONA Platform</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.2);">&copy; ${new Date().getFullYear()} SONA Digital Assets Platform. &#1580;&#1605;&#1610;&#1593; &#1575;&#1604;&#1581;&#1602;&#1608;&#1602; &#1605;&#1581;&#1601;&#1608;&#1592;&#1577;.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════
// GMAIL-COMPATIBLE RESET PASSWORD EMAIL
// No <style> tags - all inline, table-based layout, no CSS gradients
// ═══════════════════════════════════════════════════════════════════
export function generateResetPasswordHTML(userName: string, resetUrl: string): string {
  const year = new Date().getFullYear()
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>إعادة تعيين كلمة المرور - SONA Platform</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Tahoma,Arial,sans-serif;direction:rtl;line-height:1.8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">
          <tr>
            <td align="center" style="padding:0 24px 24px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#2563EB" width="56" height="56" style="color:#ffffff;font-size:26px;font-weight:800;text-align:center;">
                    <span style="color:#ffffff;font-size:26px;font-weight:800;line-height:56px;">S</span>
                  </td>
                </tr>
              </table>
              <div style="font-size:24px;font-weight:800;color:#1e3a5f;letter-spacing:1px;margin-top:12px;">SONA</div>
              <div style="font-size:12px;color:#8896a7;margin-top:2px;">Digital Assets Platform</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="border:1px solid #e2e8f0;">
                <tr>
                  <td align="center" style="padding:36px 32px 12px 32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="#eff6ff" width="64" height="64" style="text-align:center;">
                          <span style="font-size:28px;line-height:64px;">&#128272;</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:8px 32px 0 32px;">
                    <div style="font-size:20px;font-weight:700;color:#1e293b;margin-bottom:6px;">مرحباً ${userName}!</div>
                    <div style="font-size:14px;color:#64748b;margin-bottom:24px;">لقد تلقينا طلباً بإعادة تعيين كلمة مرورك. اضغط على الزر أدناه:</div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 32px 28px 32px;">
                    <a href="${resetUrl}" style="display:inline-block;background-color:#2563EB;color:#ffffff;font-family:Tahoma,Arial,sans-serif;font-size:17px;font-weight:700;padding:16px 48px;text-decoration:none;">إعادة تعيين كلمة المرور</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 32px 0 32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="#fffbeb" width="100%" style="border:1px solid #fde68a;">
                      <tr>
                        <td align="center" style="padding:10px 16px;">
                          <span style="font-size:13px;color:#92400e;">&#9200; هذا الرابط صالح لمدة <strong>15 دقيقة</strong> فقط</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 32px 0 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="font-size:0;line-height:1px;" bgcolor="#e2e8f0" height="1">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 32px 32px 32px;">
                    <div style="font-size:13px;color:#94a3b8;line-height:2;">
                      <strong style="color:#64748b;">&#9888; ملاحظة:</strong> إذا لم تطلب هذا التغيير، يرجى تجاهل هذه الرسالة.<br/>
                      لا تشارك هذا الرابط مع أي شخص لحماية حسابك.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 24px 0 24px;">
              <div style="font-size:13px;font-weight:700;color:#2563EB;margin-bottom:4px;">SONA Platform</div>
              <div style="font-size:11px;color:#94a3b8;">&copy; ${year} SONA Digital Assets Platform. جميع الحقوق محفوظة.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
