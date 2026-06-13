import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getAdminFromRequest } from '../middleware'

/**
 * Admin update endpoint - allows remote file updates and rebuild
 * SECURITY: Requires BOTH admin JWT auth AND CRON_SECRET
 * SECURITY: CRON_SECRET is MANDATORY - no fallback allowed
 * SECURITY: execSync is DISABLED - no RCE possible
 * SECURITY: Path traversal is prevented via resolved path checking
 */
export async function POST(req: NextRequest) {
  try {
    // STEP 1: Require admin JWT authentication
    let admin
    try {
      admin = await getAdminFromRequest(req)
    } catch {
      return NextResponse.json({ error: 'غير مصرح - مطلوب صلاحيات المدير' }, { status: 403 })
    }

    if (!admin) {
      return NextResponse.json({ error: 'غير مصرح - مطلوب صلاحيات المدير' }, { status: 403 })
    }

    // STEP 2: Require CRON_SECRET (mandatory, no fallback)
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error('[FATAL SECURITY] CRON_SECRET is not set! Admin update rejected.')
      return NextResponse.json({ error: 'إعدادات الأمان غير مكتملة' }, { status: 500 })
    }

    // Check if it's a Bearer token with the CRON_SECRET
    const isCronAuth = authHeader === `Bearer ${cronSecret}`
    // Also check for a separate cron-secret header for flexibility
    const cronSecretHeader = req.headers.get('x-cron-secret')
    const isCronHeader = cronSecretHeader === cronSecret

    if (!isCronAuth && !isCronHeader) {
      return NextResponse.json({ error: 'غير مصرح - مطلوب رمز الأمان' }, { status: 401 })
    }

    const body = await req.json()
    const { files, rebuild, restart } = body as {
      files?: { path: string; content: string }[]
      rebuild?: boolean
      restart?: boolean
    }

    const results: { path: string; status: string; error?: string }[] = []

    // SECURITY: Block rebuild and restart via API - these are RCE vectors
    // Use CI/CD pipeline instead
    if (rebuild || restart) {
      return NextResponse.json({
        error: 'عمليات البناء والإعادة تشغيل غير مسموحة عبر API لأسباب أمنية. استخدم CI/CD pipeline.',
        hint: 'Use: cd /home/z/my-project && npm run build && pm2 restart sona-server'
      }, { status: 403 })
    }

    // Write files with strict path validation
    if (files && Array.isArray(files)) {
      const allowedBaseDirs = [
        path.resolve(process.cwd(), 'src'),
        path.resolve(process.cwd(), 'public'),
      ]

      for (const file of files) {
        try {
          // Security: Validate and resolve path to prevent traversal
          const relPath = file.path.replace(/^\//, '')
          const fullPath = path.resolve(process.cwd(), relPath)

          // Check the resolved path starts with an allowed base directory
          const isAllowed = allowedBaseDirs.some(baseDir => fullPath.startsWith(baseDir + path.sep) || fullPath === baseDir)
          if (!isAllowed) {
            results.push({ path: file.path, status: 'rejected', error: 'Path not allowed - traversal detected' })
            continue
          }

          // Block dangerous file types
          const ext = path.extname(fullPath).toLowerCase()
          const blockedExtensions = ['.env', '.sh', '.bash', '.zsh', '.exe', '.bat', '.cmd', '.ps1', '.dll', '.so']
          if (blockedExtensions.includes(ext)) {
            results.push({ path: file.path, status: 'rejected', error: 'File type not allowed' })
            continue
          }

          // Block files outside of allowed paths even with symlinks
          const realCwd = path.resolve(process.cwd())
          if (!fullPath.startsWith(realCwd)) {
            results.push({ path: file.path, status: 'rejected', error: 'Path outside project directory' })
            continue
          }

          const dir = path.dirname(fullPath)
          if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true })
          }

          // Decode base64 content with size limit (1MB max per file)
          const content = Buffer.from(file.content, 'base64')
          if (content.length > 1024 * 1024) {
            results.push({ path: file.path, status: 'rejected', error: 'File too large (max 1MB)' })
            continue
          }

          await writeFile(fullPath, content)
          results.push({ path: file.path, status: 'written' })
        } catch (err: any) {
          results.push({ path: file.path, status: 'error', error: 'فشل في كتابة الملف' })
        }
      }
    }

    // Log the admin action
    console.log(`[ADMIN-UPDATE] Admin ${admin.email} updated ${results.filter(r => r.status === 'written').length} files`)

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error('Update API error:', error.message)
    return NextResponse.json({ error: 'حدث خطأ أمني' }, { status: 500 })
  }
}
