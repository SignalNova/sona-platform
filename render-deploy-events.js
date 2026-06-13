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
    
    // Go to events page
    await page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg/events', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 8000));
    
    // Get all event text
    const events = await page.evaluate(() => {
      const elements = document.querySelectorAll('[class*="event"], [class*="timeline"], [class*="item"]');
      return Array.from(elements).slice(0, 20).map(e => e.textContent?.trim().substring(0, 150));
    });
    
    console.log('Events:');
    events.forEach(e => { if (e && e.length > 5) console.log('  -', e); });
    
    // Also check the full page text for deploy status
    const fullText = await page.locator('body').textContent() || '';
    
    // Look for the latest deploy status
    if (fullText.includes('Build failed')) {
      console.log('\nBUILD FAILED!');
      // Find the error
      const failIdx = fullText.indexOf('failed');
      console.log('Context:', fullText.substring(Math.max(0, failIdx - 100), failIdx + 200));
    } else if (fullText.includes('Build successful')) {
      console.log('\nBUILD SUCCESSFUL!');
    } else if (fullText.includes('deploy started') || fullText.includes('Build started')) {
      console.log('\nBUILD IN PROGRESS...');
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/render-events.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
