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
    
    // Load saved cookies for Render
    const fs = require('fs');
    const savedAuth = JSON.parse(fs.readFileSync('/home/z/my-project/render-auth.json'));
    
    // Set cookies
    const cookies = savedAuth.cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires > 0 ? c.expires : undefined,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite?.charAt(0).toUpperCase() + c.sameSite?.slice(1).toLowerCase() || 'Lax'
    }));
    await context.addCookies(cookies);
    
    // Also set localStorage
    await page.goto('https://dashboard.render.com', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // Set localStorage items from saved auth
    for (const origin of savedAuth.origins || []) {
      for (const item of origin.localStorage || []) {
        await page.evaluate(({key, value}) => {
          localStorage.setItem(key, value);
        }, { key: item.name, value: item.value }).catch(() => {});
      }
    }
    
    // Now reload
    await page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    const url = page.url();
    console.log('Service page URL:', url);
    
    // Check if we're logged in
    const renderAuth = await page.evaluate(() => localStorage.getItem('render-auth')).catch(() => null);
    if (renderAuth) {
      console.log('Auth token found in localStorage!');
      const auth = JSON.parse(renderAuth);
      fs.writeFileSync('/home/z/my-project/render-token.txt', auth.idToken);
      
      // Try to trigger manual deploy
      console.log('Looking for Manual Deploy button...');
      const pageText = await page.locator('body').textContent() || '';
      
      if (pageText.includes('Manual Deploy')) {
        console.log('Found Manual Deploy! Clicking...');
        await page.locator('button:has-text("Manual Deploy")').first().click();
        await new Promise(r => setTimeout(r, 2000));
        
        await page.screenshot({ path: '/home/z/my-project/download/render-manual-deploy.png' });
        
        // Click "Deploy latest commit"
        const deployBtn = page.locator('button:has-text("Deploy latest"), button:has-text("deploy")').first();
        if (await deployBtn.count() > 0) {
          await deployBtn.click();
          console.log('Deploy triggered!');
        }
      } else {
        console.log('Manual Deploy button not found');
        console.log('Page snippet:', pageText.substring(0, 300));
      }
    } else {
      console.log('Not logged in');
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/render-state.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
