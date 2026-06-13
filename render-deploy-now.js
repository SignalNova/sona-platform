const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
    
    // Login
    await page.goto('https://dashboard.render.com/login', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.locator('input[type="email"]').first().fill('helpsona.support@gmail.com');
    await page.locator('input[type="password"]').first().fill('*R^,6Nc($8H7T*X');
    await page.locator('button:has-text("Log In"), button[type="submit"]').first().click();
    await page.waitForTimeout(10000);
    
    // Deploy
    await page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', { timeout: 30000 });
    await page.waitForTimeout(8000);
    
    await page.locator('button:has-text("Manual Deploy")').first().click();
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Deploy latest")').first().click();
    console.log('DEPLOY TRIGGERED!');
    
  } catch(e) { console.error('Error:', e.message); }
  finally { if(browser) await browser.close(); }
})();
