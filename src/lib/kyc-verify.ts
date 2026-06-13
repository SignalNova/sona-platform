import { prisma } from '@/lib/prisma'
import { KYCVault } from '@/lib/kyc-vault'
import ZAI from 'z-ai-web-dev-sdk'

export interface AIVerificationResult {
  approved: boolean
  confidence: number
  reasons: string[]
}

/**
 * Resolve a document image value to a data URL suitable for AI vision analysis.
 * Handles three cases:
 * 1. Already a data URL (data:image/...) — pass through
 * 2. Already a base64 string without prefix — add data URL prefix
 * 3. A vault doc ID (doc_timestamp_hex) — retrieve and decrypt from KYCVault
 */
async function resolveImageUrl(userId: string, imageValue: string): Promise<string> {
  // Case 1: Already a data URL
  if (imageValue.startsWith('data:image/')) {
    return imageValue
  }

  // Case 3: Vault document ID — retrieve and decrypt
  if (imageValue.startsWith('doc_')) {
    try {
      const decryptedBuffer = await KYCVault.retrieveDocument(userId, imageValue)
      const base64 = decryptedBuffer.toString('base64')
      // Detect image type from magic bytes
      const mime = detectMimeType(decryptedBuffer)
      return `data:${mime};base64,${base64}`
    } catch (error) {
      console.error('[KYC AI Verify] Failed to retrieve vault document:', imageValue, error)
      throw new Error(`Failed to retrieve vault document: ${imageValue}`)
    }
  }

  // Case 2: Raw base64 string — add prefix
  return `data:image/jpeg;base64,${imageValue}`
}

/**
 * Detect MIME type from file magic bytes
 */
function detectMimeType(buffer: Buffer): string {
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png'
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return 'image/webp'
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif'
  return 'image/jpeg' // default fallback
}

/**
 * Check for duplicate KYC submissions (same ID number across different accounts)
 */
async function checkForDuplicateKYC(userId: string, idNumber?: string | null): Promise<{ isDuplicate: boolean; matchedUserId?: string }> {
  if (!idNumber) return { isDuplicate: false }

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        kycIdNumber: idNumber,
        id: { not: userId },
        kycStatus: { in: ['VERIFIED', 'PENDING'] },
      },
      select: { id: true },
    })

    if (existingUser) {
      return { isDuplicate: true, matchedUserId: existingUser.id }
    }
  } catch (error) {
    console.error('[KYC AI Verify] Duplicate check error:', error)
  }

  return { isDuplicate: false }
}

/**
 * Perform AI-based verification of ID document images.
 */
export async function performAIVerification(params: {
  frontImage: string
  backImage: string
  country: string
  documentType: string
  videoUrl?: string
}): Promise<AIVerificationResult> {
  const { frontImage, backImage, country, documentType, videoUrl } = params

  const defaultReject: AIVerificationResult = {
    approved: false,
    confidence: 0,
    reasons: ['فشل التحقق الآلي - يرجى إعادة المحاولة'],
  }

  try {
    const zai = await ZAI.create()

    const systemPrompt = `You are an expert AI document verification system for a financial platform. Your task is to analyze identity document images and determine their authenticity and validity.

You must carefully examine the provided images and return a JSON response with the following structure:
{
  "approved": boolean,
  "confidence": number (0-100),
  "reasons": string[] (list of findings, both positive and negative)
}

Analysis criteria (evaluate EACH one):

1. **Document Type Validity**: Is the uploaded image actually a valid government-issued ID document (passport, national ID, driver's license)? Not a random piece of paper, not a screenshot of a website, not a printed copy of a digital document.

2. **Image Quality**: Is the image clear and not blurry? Can the text and details be read clearly? Is the image properly lit? Is there glare or shadow obscuring important details?

3. **Screen Photo Detection**: Is this a photo of a physical document, or is it a photo of a screen/monitor displaying the document? Look for:
   - Moiré patterns (wavy lines from screen refresh)
   - Screen bezels or edges visible
   - Reflections on screen surface
   - Pixel patterns typical of screens

4. **Front/Back Consistency**: Do the front and back images appear to belong to the same document? Check:
   - Consistent document style and design
   - Matching document number (if visible on both sides)
   - Same document condition/wear
   - Same image quality and lighting (suggesting same capture session)

5. **Country Verification**: Does the document appear to originate from the declared country (${country})? Check for:
   - Country name or code on the document
   - Language/script used matches the country
   - Document design matches known formats for that country

6. **Signs of Tampering**: Are there any signs the document has been altered or is fraudulent? Look for:
   - Inconsistent fonts or text sizes
   - Misaligned text or images
   - Color inconsistencies
   - Visible editing artifacts
   - Missing security features (holograms, watermarks if expected)

7. **Document Expiry**: If visible, check if the document appears to be expired or about to expire.

8. **Selfie Match**: If a selfie image is provided as the second image, check if the person in the selfie appears to be the same person shown on the ID document.

IMPORTANT RULES:
- Be thorough but fair. Minor image quality issues should not automatically reject.
- A confidence score of 70 or above means APPROVED, below 70 means REJECTED.
- Provide specific reasons for your decision.
- If the document looks legitimate but image quality is slightly poor, consider a confidence score in the 60-75 range.
- If there are clear signs of fraud, the confidence should be below 30.
- Return ONLY valid JSON, no additional text.
${videoUrl ? `\n9. **Video Verification**: A selfie video URL was also provided (${videoUrl}). Note if this adds to verification confidence.` : ''}`

    const response = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Please verify this identity document. Country: ${country}, Document Type: ${documentType}. Front image is first, back image is second.`,
            },
            {
              type: 'image_url',
              image_url: { url: frontImage },
            },
            {
              type: 'image_url',
              image_url: { url: backImage },
            },
          ] as any,
        },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      console.error('[KYC AI Verify] Empty AI response')
      return defaultReject
    }

    // Parse the JSON response - handle potential markdown code blocks
    let jsonStr = content.trim()
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }
    jsonStr = jsonStr.trim()

    const parsed = JSON.parse(jsonStr)

    // Validate the response structure
    if (
      typeof parsed.approved !== 'boolean' ||
      typeof parsed.confidence !== 'number' ||
      !Array.isArray(parsed.reasons)
    ) {
      console.error('[KYC AI Verify] Invalid AI response structure:', parsed)
      return defaultReject
    }

    return {
      approved: parsed.approved,
      confidence: Math.max(0, Math.min(100, parsed.confidence)),
      reasons: parsed.reasons,
    }
  } catch (error) {
    console.error('[KYC AI Verify] AI processing error:', error)
    return defaultReject
  }
}

/**
 * Run the full AI verification pipeline for a user:
 * 1. Check for duplicate KYC (same ID number across accounts)
 * 2. Resolve document images from vault/base64
 * 3. Perform AI analysis on document images
 * 4. Update the user's KYC status based on the result
 * 5. Send in-app notification
 * 6. Attempt to send email notification
 */
export async function runAIVerificationPipeline(userId: string): Promise<AIVerificationResult> {
  // Fetch the user with KYC data
  const fullUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      kycStatus: true,
      kycCountry: true,
      kycDocumentType: true,
      kycFrontImage: true,
      kycBackImage: true,
      kycSelfieImage: true,
      kycVideoUrl: true,
      kycAiStatus: true,
      kycIdNumber: true,
    },
  })

  if (!fullUser) {
    throw new Error(`User not found: ${userId}`)
  }

  if (!fullUser.kycFrontImage) {
    throw new Error('Front document image not available for AI verification')
  }

  // Step 1: Check for duplicate KYC submissions
  const duplicateCheck = await checkForDuplicateKYC(userId, fullUser.kycIdNumber)
  if (duplicateCheck.isDuplicate) {
    const rejectResult: AIVerificationResult = {
      approved: false,
      confidence: 0,
      reasons: ['تم العثور على حساب آخر مسجل بنفس رقم الهوية. يُمنع وجود أكثر من حساب واحد لنفس الشخص.'],
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: 'REJECTED',
        kycAiStatus: 'REJECTED',
        kycRejectReason: 'DUPLICATE_ID',
        kycRejectCode: 'DUPLICATE',
        kycAiResult: JSON.stringify(rejectResult),
      },
    })

    await sendKYCNotification(userId, false, rejectResult)
    await sendKYCEmailNotification(fullUser.email, fullUser.name, false, rejectResult)

    return rejectResult
  }

  // Step 2: Resolve document images (decrypt from vault if needed)
  const frontImageUrl = await resolveImageUrl(userId, fullUser.kycFrontImage)

  // Use back image if available, otherwise fall back to selfie image
  const backImageValue = fullUser.kycBackImage || fullUser.kycSelfieImage
  if (!backImageValue) {
    throw new Error('Insufficient document images for AI verification')
  }
  const backImageUrl = await resolveImageUrl(userId, backImageValue)

  // Mark AI status as PROCESSING
  await prisma.user.update({
    where: { id: userId },
    data: { kycAiStatus: 'PROCESSING' },
  })

  // Step 3: Run AI verification with resolved images
  const aiResult = await performAIVerification({
    frontImage: frontImageUrl,
    backImage: backImageUrl,
    country: fullUser.kycCountry || '',
    documentType: fullUser.kycDocumentType || '',
    videoUrl: fullUser.kycVideoUrl || undefined,
  })

  // Step 4: Process the result — confidence >= 70% means approved
  const isApproved = aiResult.confidence >= 70

  if (isApproved) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: 'VERIFIED',
        kycAiStatus: 'APPROVED',
        kycVerifiedAt: new Date(),
        kycAiResult: JSON.stringify(aiResult),
        kycRejectReason: null,
        kycRejectCode: null,
      },
    })
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: 'REJECTED',
        kycAiStatus: 'REJECTED',
        kycRejectReason: aiResult.reasons.join(' | '),
        kycAiResult: JSON.stringify(aiResult),
      },
    })
  }

  // Step 5: Send in-app notification
  await sendKYCNotification(userId, isApproved, aiResult)

  // Step 6: Try to send email notification
  await sendKYCEmailNotification(fullUser.email, fullUser.name, isApproved, aiResult)

  return aiResult
}

/**
 * Send an in-app notification about KYC verification result.
 */
async function sendKYCNotification(
  userId: string,
  isApproved: boolean,
  result: AIVerificationResult
) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: isApproved ? 'تم التحقق من الهوية بنجاح ✅' : 'تم رفض التحقق من الهوية ❌',
        message: isApproved
          ? 'تهانينا! تم التحقق من هويتك بنجاح. يمكنك الآن الاستفادة من جميع خدمات المنصة.'
          : `تم رفض طلب التحقق من الهوية. الأسباب: ${result.reasons.slice(0, 3).join('، ')}. يمكنك إعادة التقديم بعد تصحيح الملاحظات.`,
      },
    })
  } catch (error) {
    console.error('[KYC AI Verify] Failed to send notification:', error)
  }
}

/**
 * Try to send an email notification about KYC verification result.
 */
async function sendKYCEmailNotification(
  email: string,
  userName: string,
  isApproved: boolean,
  result: AIVerificationResult
) {
  try {
    const nodemailer = await import('nodemailer')

    const SMTP_HOST = process.env.SMTP_HOST
    const SMTP_USER = process.env.SMTP_USER
    const SMTP_PASS = process.env.SMTP_PASS

    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.default.createTransport({
        host: SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      })

      await transporter.sendMail({
        from: `"سونا" <${SMTP_USER}>`,
        to: email,
        subject: isApproved ? 'تم التحقق من هويتك - سونا' : 'نتيجة التحقق من الهوية - سونا',
        html: generateKYCEmailHTML(userName, isApproved, result),
      })
    }

    // Also try Resend if available
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    if (RESEND_API_KEY && RESEND_API_KEY !== 're_demo_key') {
      const { Resend } = await import('resend')
      const resend = new Resend(RESEND_API_KEY)
      await resend.emails.send({
        from: 'سونا <noreply@sona-invest.com>',
        to: email,
        subject: isApproved ? 'تم التحقق من هويتك - سونا' : 'نتيجة التحقق من الهوية - سونا',
        html: generateKYCEmailHTML(userName, isApproved, result),
      })
    }
  } catch (error) {
    console.error('[KYC AI Verify] Failed to send email notification:', error)
  }
}

/**
 * Generate HTML email for KYC verification result.
 */
function generateKYCEmailHTML(
  userName: string,
  isApproved: boolean,
  result: AIVerificationResult
): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${isApproved ? 'تم التحقق من الهوية' : 'نتيجة التحقق من الهوية'} - سونا</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif; background-color: #0a0a0a; color: #ffffff; direction: rtl; line-height: 1.8; }
    .container { max-width: 520px; margin: 0 auto; padding: 40px 24px; }
    .header { text-align: center; margin-bottom: 36px; }
    .logo-text { font-size: 28px; font-weight: 800; color: #c9a84c; letter-spacing: 1px; }
    .logo-sub { font-size: 13px; color: rgba(255,255,255,0.4); margin-top: 4px; }
    .card { background: linear-gradient(145deg, rgba(201,168,76,0.08), rgba(201,168,76,0.02)); border: 1px solid rgba(201,168,76,0.15); border-radius: 20px; padding: 40px 32px; text-align: center; }
    .icon-wrap { display: inline-flex; align-items: center; justify-content: center; width: 72px; height: 72px; border-radius: 20px; margin-bottom: 24px; }
    .icon-approved { background: rgba(34,197,94,0.15); }
    .icon-rejected { background: rgba(239,68,68,0.15); }
    .greeting { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
    .subtitle { font-size: 15px; color: rgba(255,255,255,0.5); margin-bottom: 20px; }
    .result-badge { display: inline-block; padding: 8px 24px; border-radius: 12px; font-weight: 700; font-size: 16px; margin-bottom: 20px; }
    .badge-approved { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
    .badge-rejected { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
    .confidence { font-size: 14px; color: rgba(255,255,255,0.4); margin-bottom: 16px; }
    .reasons { text-align: right; margin: 20px 0; }
    .reason-item { padding: 8px 12px; margin: 6px 0; background: rgba(255,255,255,0.03); border-radius: 8px; font-size: 13px; color: rgba(255,255,255,0.6); }
    .divider { height: 1px; background: rgba(255,255,255,0.06); margin: 28px 0; }
    .tip { font-size: 13px; color: rgba(255,255,255,0.3); line-height: 1.9; }
    .footer { text-align: center; margin-top: 36px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); }
    .footer-brand { font-size: 14px; font-weight: 700; color: #c9a84c; margin-bottom: 4px; }
    .footer-text { font-size: 11px; color: rgba(255,255,255,0.2); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-text">سونا</div>
      <div class="logo-sub">SONA Digital Assets Ltd.</div>
    </div>
    <div class="card">
      <div class="icon-wrap ${isApproved ? 'icon-approved' : 'icon-rejected'}">
        <span style="font-size:36px">${isApproved ? '✅' : '❌'}</span>
      </div>
      <div class="greeting">مرحباً ${userName}!</div>
      <div class="subtitle">${isApproved ? 'تم التحقق من هويتك بنجاح' : 'لم يتم التحقق من هويتك'}</div>
      <div class="result-badge ${isApproved ? 'badge-approved' : 'badge-rejected'}">
        ${isApproved ? 'تم التحقق ✓' : 'مرفوض ✗'}
      </div>
      <div class="confidence">نسبة الثقة: ${result.confidence}%</div>
      ${result.reasons.length > 0 ? `
      <div class="reasons">
        <div style="font-size:14px;font-weight:600;margin-bottom:8px;color:rgba(255,255,255,0.5)">${isApproved ? 'ملاحظات التحقق:' : 'أسباب الرفض:'}</div>
        ${result.reasons.map((r) => `<div class="reason-item">${r}</div>`).join('')}
      </div>` : ''}
      <div class="divider"></div>
      <div class="tip">
        ${isApproved
          ? '<strong>تهانينا!</strong> يمكنك الآن الاستفادة من جميع خدمات المنصة بما في ذلك السحب والاستثمار.'
          : '<strong>ملاحظة:</strong> يمكنك إعادة تقديم طلب التحقق بعد تصحيح الملاحظات المذكورة أعلاه.'}
      </div>
    </div>
    <div class="footer">
      <div class="footer-brand">سونا</div>
      <div class="footer-text">&copy; ${new Date().getFullYear()} سونا - SONA Digital Assets Ltd. جميع الحقوق محفوظة.</div>
    </div>
  </div>
</body>
</html>`
}
