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
    
    // Go to settings page
    await page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg/settings', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 8000));
    
    const pageText = await page.locator('body').textContent() || '';
    
    // Check auto-deploy settings
    if (pageText.includes('Auto-Deploy')) {
      console.log('Auto-Deploy setting found');
    }
    if (pageText.includes('Yes') || pageText.includes('Enabled')) {
      console.log('Auto-Deploy appears enabled');
    } else if (pageText.includes('No') || pageText.includes('Disabled')) {
      console.log('Auto-Deploy appears DISABLED');
    }
    
    // Get branch info
    if (pageText.includes('Branch')) {
      const branchMatch = pageText.match(/Branch[^]*?main/);
      if (branchMatch) console.log('Branch setting:', branchMatch[0].substring(0, 50));
    }
    
    // Check if the GitHub connection is still valid
    if (pageText.includes('GitHub') || pageText.includes('SignalNova')) {
      console.log('GitHub repo connected');
    }
    
    // Find and click Manual Deploy from settings page to get the LATEST code
    const manualBtn = page.locator('button:has-text("Manual Deploy")').first();
    if (await manualBtn.count() > 0) {
      console.log('Found Manual Deploy button - clicking...');
      await manualBtn.click();
      await new Promise(r => setTimeout(r, 2000));
      
      // Check what commit is being deployed
      const deployMenu = await page.locator('body').textContent() || '';
      console.log('Deploy menu snippet:', deployMenu.substring(0, 500));
      
      // Click "Deploy latest commit"
      const deployBtn = page.locator('button:has-text("Deploy latest")').first();
      if (await deployBtn.count() > 0) {
        await deployBtn.click();
        console.log('DEPLOY TRIGGERED!');
      }
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/render-settings.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
