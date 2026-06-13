import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { spawn } = await import('child_process');
    
    return new Promise<NextResponse>((resolve) => {
      const child = spawn('cloudflared', [
        'tunnel', '--protocol', 'http2', '--no-autoupdate',
        '--url', 'http://localhost:3000'
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let tunnelUrl = '';
      let resolved = false;
      let output = '';

      const extractUrl = (data: Buffer) => {
        const text = data.toString();
        output += text;
        
        const urlMatch = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (urlMatch && !resolved) {
          tunnelUrl = urlMatch[0];
          resolved = true;
          
          try {
            const fs = require('fs');
            fs.writeFileSync('/tmp/current-tunnel-url.txt', tunnelUrl);
          } catch {}

          resolve(NextResponse.json({
            success: true,
            url: tunnelUrl,
            message: 'Tunnel created! Open the URL quickly - it may become unreachable after some time.'
          }));
        }
      };

      child.stdout.on('data', extractUrl);
      child.stderr.on('data', extractUrl);

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill();
          resolve(NextResponse.json({
            success: false,
            error: 'Could not create tunnel within 30 seconds',
            output: output.slice(-500)
          }, { status: 500 }));
        }
      }, 30000);
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
