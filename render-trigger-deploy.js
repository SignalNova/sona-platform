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
    
    // Go to service page
    await page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 8000));
    
    // Check if deploy already started
    const pageText = await page.locator('body').textContent() || '';
    if (pageText.includes('Build successful') || pageText.includes('Live')) {
      console.log('Already deployed and live!');
    } else if (pageText.includes('Building') || pageText.includes('building')) {
      console.log('Build in progress...');
    } else {
      // Click Manual Deploy
      const manualBtn = page.locator('button:has-text("Manual Deploy")').first();
      if (await manualBtn.count() > 0) {
        await manualBtn.click();
        await new Promise(r => setTimeout(r, 2000));
        const deployBtn = page.locator('button:has-text("Deploy latest")').first();
        if (await deployBtn.count() > 0) {
          await deployBtn.click();
          console.log('Manual deploy triggered!');
        }
      }
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/render-deploy-status.png' });
    console.log('Done');
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
