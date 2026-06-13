const { chromium } = require('playwright');
const fs = require('fs');

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
    
    console.log('Logged in, URL:', page.url());
    
    // Navigate to API Keys settings
    console.log('Navigating to API Keys...');
    await page.goto('https://dashboard.render.com/u/tea-d8l1t9kvikkc73cab7qg/api-keys', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('API keys page URL:', page.url());
    const pageText = await page.locator('body').textContent() || '';
    console.log('Page snippet:', pageText.substring(0, 300));
    
    // Create a new API key
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Generate")').first();
    if (await createBtn.count() > 0) {
      await createBtn.click();
      await new Promise(r => setTimeout(r, 3000));
      
      // Fill the name
      await page.locator('input[type="text"]').first().fill('SONA Deploy Key').catch(() => {});
      
      // Click create/save
      await page.locator('button:has-text("Create"), button:has-text("Save"), button:has-text("Generate")').first().click();
      await new Promise(r => setTimeout(r, 5000));
      
      // Get the API key
      const apiKeyText = await page.locator('body').textContent() || '';
      const keyMatch = apiKeyText.match(/rnd_[A-Za-z0-9_]{20,}/);
      if (keyMatch) {
        console.log('API KEY:', keyMatch[0]);
        fs.writeFileSync('/home/z/my-project/render-api-key.txt', keyMatch[0]);
      }
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/render-api-keys.png' });
    
    // Also try to trigger manual deploy from the service page
    console.log('Triggering manual deploy...');
    await page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    // Click Manual Deploy
    const manualBtn = page.locator('button:has-text("Manual Deploy")').first();
    if (await manualBtn.count() > 0) {
      await manualBtn.click();
      await new Promise(r => setTimeout(r, 2000));
      
      // Click Deploy latest commit
      const deployBtn = page.locator('button:has-text("Deploy latest"), button:has-text("deploy")').first();
      if (await deployBtn.count() > 0) {
        await deployBtn.click();
        console.log('MANUAL DEPLOY TRIGGERED!');
      }
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/render-deploy-triggered.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
