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
    console.log('Step 1: Logging into Render...');
    await page.goto('https://dashboard.render.com/login', { waitUntil: 'networkidle', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    
    await page.locator('input[type="email"]').first().fill('helpsona.support@gmail.com');
    await page.locator('input[type="password"]').first().fill('*R^,6Nc($8H7T*X');
    await page.locator('button:has-text("Log In"), button[type="submit"]').first().click();
    await new Promise(r => setTimeout(r, 10000));
    
    console.log('Logged in, navigating to service...');
    
    // Go to the service page
    await page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 8000));
    
    console.log('Service page URL:', page.url());
    
    // Take screenshot
    await page.screenshot({ path: '/home/z/my-project/download/render-service-main.png' });
    
    // Look for Manual Deploy button in the page
    const pageText = await page.locator('body').textContent() || '';
    console.log('Has Manual Deploy:', pageText.includes('Manual Deploy'));
    console.log('Has deploy:', pageText.includes('deploy'));
    
    // Try to find and click the Manual Deploy button
    // Render has a specific layout - the button might be in a dropdown
    const allButtons = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      return Array.from(btns).filter(b => b.offsetParent !== null).map(b => ({
        text: b.textContent?.trim().substring(0, 60),
        className: b.className?.substring(0, 50)
      }));
    });
    console.log('Visible buttons:', JSON.stringify(allButtons.filter(b => b.text)));
    
    // Try clicking Manual Deploy
    const manualDeployBtn = page.locator('button:has-text("Manual Deploy")').first();
    if (await manualDeployBtn.count() > 0) {
      console.log('Clicking Manual Deploy...');
      await manualDeployBtn.click();
      await new Promise(r => setTimeout(r, 3000));
      
      await page.screenshot({ path: '/home/z/my-project/download/render-manual-deploy-menu.png' });
      
      // Look for deploy latest commit
      const deployLatestBtn = page.locator('button:has-text("Deploy latest"), a:has-text("Deploy latest")').first();
      if (await deployLatestBtn.count() > 0) {
        await deployLatestBtn.click();
        console.log('DEPLOY LATEST COMMIT CLICKED!');
        await new Promise(r => setTimeout(r, 5000));
        await page.screenshot({ path: '/home/z/my-project/download/render-deploy-started.png' });
      } else {
        console.log('No Deploy latest button found');
        // Try other buttons in the menu
        const menuButtons = await page.evaluate(() => {
          const btns = document.querySelectorAll('button');
          return Array.from(btns).filter(b => b.offsetParent !== null).map(b => b.textContent?.trim().substring(0, 60));
        });
        console.log('Menu buttons:', menuButtons);
      }
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
