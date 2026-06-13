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
    console.log('Logging into Render...');
    await page.goto('https://dashboard.render.com/login', { waitUntil: 'networkidle', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    await page.locator('input[type="email"]').first().fill('helpsona.support@gmail.com');
    await page.locator('input[type="password"]').first().fill('*R^,6Nc($8H7T*X');
    await page.locator('button:has-text("Log In"), button[type="submit"]').first().click();
    await new Promise(r => setTimeout(r, 10000));
    
    // Go to service page
    await page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 8000));
    
    // Click Manual Deploy button
    const manualBtn = page.locator('button:has-text("Manual Deploy")').first();
    await manualBtn.click();
    await new Promise(r => setTimeout(r, 2000));
    
    // Click Deploy latest commit
    const deployBtn = page.locator('button:has-text("Deploy latest")').first();
    await deployBtn.click();
    console.log('Manual deploy triggered with latest code from GitHub!');
    
    await new Promise(r => setTimeout(r, 5000));
    
    // Wait and check for build to start
    const pageText = await page.locator('body').textContent() || '';
    if (pageText.includes('36411c4') || pageText.includes('91a44551') || pageText.includes('Resend')) {
      console.log('New code detected in deploy!');
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/render-final-deploy.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
