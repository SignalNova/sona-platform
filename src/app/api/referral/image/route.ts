import { NextRequest, NextResponse } from 'next/server'
import { createCanvas, registerFont } from 'canvas'
import { getUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const referralCode = user.referralCode || 'SONA'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sonainvest.com'
    const referralLink = `${baseUrl}?ref=${referralCode}`

    // Register font
    try {
      const fs = await import('fs')
      const fontPath = '/usr/share/fonts/truetype/chinese/NotoSansSC[wght].ttf'
      if (fs.existsSync(fontPath)) {
        registerFont(fontPath, { family: 'NotoSans' })
      }
    } catch {}

    const width = 1200
    const height = 630
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height)
    bgGrad.addColorStop(0, '#0a0e17')
    bgGrad.addColorStop(0.5, '#0d1520')
    bgGrad.addColorStop(1, '#0a0e17')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, width, height)

    // Grid
    ctx.strokeStyle = 'rgba(64, 158, 255, 0.03)'
    ctx.lineWidth = 1
    for (let x = 0; x < width; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke() }
    for (let y = 0; y < height; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke() }

    // Glow
    const centerX = width / 2
    const centerY = 200
    const glowGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 200)
    glowGrad.addColorStop(0, 'rgba(64, 158, 255, 0.15)')
    glowGrad.addColorStop(0.5, 'rgba(64, 158, 255, 0.05)')
    glowGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = glowGrad
    ctx.fillRect(0, 0, width, height)

    // Hexagon
    ctx.beginPath()
    const hexSize = 60
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6
      const x = centerX + hexSize * Math.cos(angle)
      const y = centerY + hexSize * Math.sin(angle)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.closePath()
    const hexGrad = ctx.createLinearGradient(centerX - hexSize, centerY - hexSize, centerX + hexSize, centerY + hexSize)
    hexGrad.addColorStop(0, '#409eff')
    hexGrad.addColorStop(1, '#337ecc')
    ctx.fillStyle = hexGrad
    ctx.fill()

    // S
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 50px NotoSans, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('S', centerX, centerY + 2)

    // SONA
    ctx.font = 'bold 72px NotoSans, Arial, sans-serif'
    const sonaGrad = ctx.createLinearGradient(centerX - 100, 0, centerX + 100, 0)
    sonaGrad.addColorStop(0, '#409eff')
    sonaGrad.addColorStop(0.5, '#5bb8ff')
    sonaGrad.addColorStop(1, '#04cf99')
    ctx.fillStyle = sonaGrad
    ctx.fillText('SONA', centerX, centerY + 100)

    // Subtitle
    ctx.font = '24px NotoSans, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillText('Invest & Earn', centerX, centerY + 140)

    // Divider
    ctx.beginPath()
    ctx.moveTo(centerX - 200, centerY + 175)
    ctx.lineTo(centerX + 200, centerY + 175)
    const lineGrad = ctx.createLinearGradient(centerX - 200, 0, centerX + 200, 0)
    lineGrad.addColorStop(0, 'transparent')
    lineGrad.addColorStop(0.5, 'rgba(64, 158, 255, 0.4)')
    lineGrad.addColorStop(1, 'transparent')
    ctx.strokeStyle = lineGrad
    ctx.lineWidth = 1
    ctx.stroke()

    // Invitation
    ctx.font = '20px NotoSans, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.fillText('INVITATION', centerX, centerY + 210)

    // Code box
    const codeBoxY = centerY + 230
    const codeBoxH = 50
    const codeBoxW = 300
    const codeBoxX = centerX - codeBoxW / 2
    ctx.fillStyle = 'rgba(64, 158, 255, 0.1)'
    ctx.strokeStyle = 'rgba(64, 158, 255, 0.3)'
    ctx.lineWidth = 1
    roundRect(ctx, codeBoxX, codeBoxY, codeBoxW, codeBoxH, 12)
    ctx.fill(); ctx.stroke()

    ctx.font = 'bold 28px NotoSans, monospace'
    ctx.fillStyle = '#409eff'
    ctx.fillText(referralCode, centerX, codeBoxY + codeBoxH / 2 + 2)

    // Link
    ctx.font = '16px NotoSans, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.fillText(referralLink, centerX, codeBoxY + codeBoxH + 30)

    // Bottom
    ctx.font = '14px NotoSans, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
    ctx.fillText('$5 Bonus for Every Referral', centerX, height - 30)

    // Candles
    function drawCandle(x: number, y: number, h: number, isGreen: boolean) {
      ctx.fillStyle = isGreen ? 'rgba(4, 207, 153, 0.2)' : 'rgba(255, 77, 77, 0.2)'
      ctx.fillRect(x - 4, y - h / 2, 8, h)
      ctx.fillStyle = isGreen ? 'rgba(4, 207, 153, 0.4)' : 'rgba(255, 77, 77, 0.4)'
      ctx.fillRect(x - 0.5, y - h, 1, h * 2)
    }
    drawCandle(80, 180, 40, true); drawCandle(100, 160, 50, false); drawCandle(120, 200, 30, true)
    drawCandle(140, 170, 45, true); drawCandle(160, 190, 35, false)
    drawCandle(width-80, 180, 45, true); drawCandle(width-100, 160, 55, false); drawCandle(width-120, 200, 35, true)
    drawCandle(width-140, 170, 50, true); drawCandle(width-160, 190, 40, false)

    const buffer = canvas.toBuffer('image/png')
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Referral image error:', error)
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 })
  }
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
