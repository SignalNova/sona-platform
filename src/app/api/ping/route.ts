// Ultra-light ping endpoint - no DB, no auth, no middleware overhead
export async function GET() {
  return new Response('pong', {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain',
    },
  })
}

export async function HEAD() {
  return new Response(null, { status: 200 })
}
