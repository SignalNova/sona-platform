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
    
    // Check the deploy events
    await page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 8000));
    
    const pageText = await page.locator('body').textContent() || '';
    
    // Check for build status
    if (pageText.includes('Build successful')) {
      console.log('BUILD SUCCESSFUL - new code is live!');
    } else if (pageText.includes('Building') || pageText.includes('build in progress')) {
      console.log('BUILD IN PROGRESS...');
    } else if (pageText.includes('Build failed')) {
      console.log('BUILD FAILED!');
    } else {
      console.log('Unknown status');
    }
    
    // Get the latest deploy info
    const deployInfo = await page.evaluate(() => {
      const events = document.querySelectorAll('[class*="event"], [class*="deploy"], [class*="commit"]');
      return Array.from(events).slice(0, 5).map(e => e.textContent?.trim().substring(0, 100));
    });
    console.log('Deploy events:', JSON.stringify(deployInfo));
    
    // Take screenshot
    await page.screenshot({ path: '/home/z/my-project/download/render-build-status.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
