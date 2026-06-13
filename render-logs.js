const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    
    // Login to Render
    await page.goto('https://dashboard.render.com/login', { waitUntil: 'networkidle', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    await page.locator('input[type="email"]').first().fill('helpsona.support@gmail.com');
    await page.locator('input[type="password"]').first().fill('*R^,6Nc($8H7T*X');
    await page.locator('button:has-text("Log In"), button[type="submit"]').first().click();
    await new Promise(r => setTimeout(r, 10000));
    
    // Go to logs
    await page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg/logs', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 8000));
    
    const pageText = await page.locator('body').textContent() || '';
    
    // Look for build-related log lines
    const lines = pageText.split('\n').filter(l => 
      l.includes('build') || l.includes('Build') || l.includes('deploy') || 
      l.includes('npm') || l.includes('Resend') || l.includes('email.ts') ||
      l.includes('36411c4') || l.includes('91a44551') || l.includes('compil')
    );
    
    console.log('Relevant log lines:');
    lines.slice(0, 15).forEach(l => console.log('  -', l.trim().substring(0, 100)));
    
    // Check current status
    if (pageText.includes('Build successful')) {
      console.log('\nBUILD SUCCESSFUL!');
    } else if (pageText.includes('Building')) {
      console.log('\nBUILD IN PROGRESS...');
    } else if (pageText.includes('failed') || pageText.includes('error')) {
      console.log('\nPOSSIBLE BUILD ERROR');
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/render-logs.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
