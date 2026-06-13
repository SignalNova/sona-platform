import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.error('🔥 CLIENT ERROR:', JSON.stringify(body, null, 2))
    // Write to file for inspection
    const fs = await import('fs')
    const path = await import('path')
    const logFile = path.join(process.cwd(), 'client-errors.log')
    fs.appendFileSync(logFile, `\n--- ${body.timestamp} ---\nMessage: ${body.message}\nStack: ${body.stack}\nDigest: ${body.digest}\n`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false })
  }
}
