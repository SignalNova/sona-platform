const { firefox } = require('playwright');
const fs = require('fs');

(async () => {
  let browser;
  try {
    browser = await firefox.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0',
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    
    // Login to Render
    console.log('Logging into Render...');
    await page.goto('https://dashboard.render.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    // Try to fill the login form
    const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
    const passInput = page.locator('input[type="password"], input[name="password"]').first();
    
    if (await emailInput.count() > 0) {
      await emailInput.fill('helpsona.support@gmail.com');
      console.log('Email filled');
    }
    if (await passInput.count() > 0) {
      await passInput.fill('*R^,6Nc($8H7T*X');
      console.log('Password filled');
    }
    
    // Click login
    await page.locator('button[type="submit"], button:has-text("Log")').first().click().catch(() => {});
    await new Promise(r => setTimeout(r, 10000));
    
    console.log('After login URL:', page.url());
    
    // Get auth token
    const renderAuth = await page.evaluate(() => localStorage.getItem('render-auth')).catch(() => null);
    
    if (renderAuth) {
      const auth = JSON.parse(renderAuth);
      console.log('TOKEN:', auth.idToken);
      fs.writeFileSync('/home/z/my-project/render-token.txt', auth.idToken);
      
      // Navigate to service and trigger deploy
      await page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', { timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000));
      
      // Take screenshot of service page
      await page.screenshot({ path: '/home/z/my-project/download/render-service-page.png' });
      
      // Try to click Manual Deploy - Render UI button
      // First look for it
      const pageText = await page.locator('body').textContent() || '';
      console.log('Service page has Manual Deploy:', pageText.includes('Manual Deploy'));
      
      // Try API deploy from browser
      const result = await page.evaluate(async (token) => {
        const resp = await fetch('https://api.render.com/v1/services/srv-d8l87el8nd3s73e0kfpg/deploys', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
        return { status: resp.status, body: await resp.text() };
      }, auth.idToken);
      console.log('Deploy API result:', JSON.stringify(result).substring(0, 500));
      
    } else {
      console.log('Failed to get auth token');
      const bodyText = await page.locator('body').textContent() || '';
      console.log('Page snippet:', bodyText.substring(0, 300));
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/render-final.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
