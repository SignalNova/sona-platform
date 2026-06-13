import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

// SECURITY: Whitelist of allowed image extensions (prevent executable uploads)
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('avatar') as File | null
    const userId = formData.get('userId') as string | null

    if (!file || !userId) {
      return NextResponse.json({ error: 'الصورة مطلوبة' }, { status: 400 })
    }

    if (userId !== user.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'يجب أن يكون الملف صورة' }, { status: 400 })
    }

    // SECURITY: Validate MIME type matches allowed types
    const ALLOWED_MIME_TYPES = new Set([
      'image/jpeg', 'image/png', 'image/gif', 'image/webp'
    ])
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'نوع الصورة غير مسموح به' }, { status: 400 })
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'حجم الصورة يجب أن يكون أقل من 2MB' }, { status: 400 })
    }

    // Save avatar
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    // SECURITY: Validate and sanitize file extension (whitelist only)
    const originalExt = file.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.has(originalExt)) {
      return NextResponse.json({ error: 'امتداد الملف غير مسموح به. يُسمح فقط بـ: jpg, jpeg, png, gif, webp' }, { status: 400 })
    }
    // SECURITY: Use crypto-generated filename instead of original name to prevent path manipulation
    const safeExt = originalExt // Already validated against whitelist
    const filename = `${userId}-${crypto.randomBytes(8).toString('hex')}.${safeExt}`
    const filepath = path.join(uploadsDir, filename)

    // SECURITY: Verify the resolved path is within the uploads directory (prevent path traversal)
    const resolvedPath = path.resolve(filepath)
    const resolvedDir = path.resolve(uploadsDir)
    if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
      return NextResponse.json({ error: 'مسار غير صالح' }, { status: 400 })
    }

    fs.writeFileSync(filepath, buffer)

    // Update user avatar in database
    const avatarUrl = `/uploads/avatars/${filename}`
    await db.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
    })

    // Send notification about avatar update
    await createNotification({
      userId,
      title: 'تحديث الصورة الشخصية',
      message: 'تم تحديث صورتك الشخصية بنجاح. إذا لم تكن أنت من قام بهذا التغيير، تواصل مع الدعم فوراً.',
      type: 'SECURITY',
      data: { action: 'avatar_update' },
    })

    return NextResponse.json({ avatar: avatarUrl, message: 'تم تحديث الصورة الشخصية' }, { status: 200 })
  } catch (error) {
    console.error('Avatar upload error:', error)
    return NextResponse.json({ error: 'حدث خطأ في رفع الصورة' }, { status: 500 })
  }
}
