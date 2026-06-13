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
    
    // Load saved cookies
    const savedAuth = JSON.parse(fs.readFileSync('/home/z/my-project/render-auth.json'));
    await context.addCookies(savedAuth.cookies);
    
    // Go to service page
    console.log('Navigating to Render service...');
    await page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('Page URL:', page.url());
    
    // Check if we're logged in
    const renderAuth = await page.evaluate(() => {
      return localStorage.getItem('render-auth');
    }).catch(() => null);
    
    if (renderAuth) {
      const auth = JSON.parse(renderAuth);
      console.log('Auth token:', auth.idToken);
      fs.writeFileSync('/home/z/my-project/render-token.txt', auth.idToken);
    }
    
    // Try to use the Render GraphQL/API from within the browser
    // This should work because the browser has valid cookies
    const deployResult = await page.evaluate(async () => {
      try {
        // Get the auth token
        const authStr = localStorage.getItem('render-auth');
        if (!authStr) return { error: 'No auth found' };
        const auth = JSON.parse(authStr);
        
        // Try to deploy via API
        const resp = await fetch('https://api.render.com/v1/services/srv-d8l87el8nd3s73e0kfpg/deploys', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${auth.idToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
        const text = await resp.text();
        return { status: resp.status, body: text.substring(0, 500) };
      } catch(e) {
        return { error: e.message };
      }
    });
    
    console.log('Deploy result:', JSON.stringify(deployResult));
    
    // If API doesn't work, try clicking the manual deploy button
    if (deployResult.status !== 200 && deployResult.status !== 201 && deployResult.status !== 202) {
      console.log('API deploy failed, trying button click...');
      
      // Look for manual deploy button
      const manualBtn = page.locator('button:has-text("Manual Deploy"), button:has-text("manual deploy")').first();
      if (await manualBtn.count() > 0) {
        await manualBtn.click();
        await new Promise(r => setTimeout(r, 2000));
        
        const deployLatestBtn = page.locator('button:has-text("Deploy latest")').first();
        if (await deployLatestBtn.count() > 0) {
          await deployLatestBtn.click();
          console.log('Manual deploy clicked!');
        }
      }
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/render-service.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
