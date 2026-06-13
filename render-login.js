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
    await page.goto('https://dashboard.render.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // Fill email/password
    await page.fill('input[name="email"], input[type="email"]', 'helpsona.support@gmail.com').catch(() => {});
    await page.fill('input[name="password"], input[type="password"]', '*R^,6Nc($8H7T*X').catch(() => {});
    
    // Click login
    await page.locator('button:has-text("Log In"), button[type="submit"]').first().click().catch(() => {});
    await new Promise(r => setTimeout(r, 10000));
    
    console.log('After login URL:', page.url());
    
    // Get the auth token from localStorage
    const renderAuth = await page.evaluate(() => {
      return localStorage.getItem('render-auth');
    }).catch(() => null);
    
    if (renderAuth) {
      const auth = JSON.parse(renderAuth);
      console.log('Got auth token:', auth.idToken);
      fs.writeFileSync('/home/z/my-project/render-token.txt', auth.idToken);
      
      // Now trigger a manual deploy via the dashboard
      console.log('Triggering manual deploy...');
      
      // Navigate to the service
      await page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', { timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000));
      
      // Click "Manual Deploy" button
      const manualDeployBtn = page.locator('button:has-text("Manual Deploy"), a:has-text("Manual Deploy")').first();
      if (await manualDeployBtn.count() > 0) {
        await manualDeployBtn.click();
        await new Promise(r => setTimeout(r, 2000));
        
        // Click "Deploy latest commit" or similar
        const deployBtn = page.locator('button:has-text("Deploy"), button:has-text("deploy")').first();
        if (await deployBtn.count() > 0) {
          await deployBtn.click();
          console.log('Manual deploy triggered!');
        }
      } else {
        console.log('Manual Deploy button not found');
      }
      
      // Try using the Render API directly
      const deployResult = await page.evaluate(async (token) => {
        try {
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
        } catch(e) {
          return { error: e.message };
        }
      }, auth.idToken);
      
      console.log('Deploy API result:', JSON.stringify(deployResult).substring(0, 500));
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/render-deploy.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
