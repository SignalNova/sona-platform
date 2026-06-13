const { firefox } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await firefox.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0',
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    
    // First, login to Porkbun
    console.log('Loading Porkbun login...');
    await page.goto('https://porkbun.com/account/login?captchaProvider=cloudflareCaptcha', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));
    
    await page.evaluate(() => { if (typeof cookieBannerSave === 'function') cookieBannerSave(true, true); }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));
    
    // Fill login
    await page.fill('#loginUsername', 'helpsona.support@gmail.com');
    await page.fill('#loginPassword', '*R^,6Nc($8H7T*X');
    
    // Wait for turnstile
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const enabled = await page.evaluate(() => {
        const btn = document.getElementById('accountLoginButton');
        return btn && !btn.disabled;
      });
      if (enabled) break;
    }
    
    // Login
    await page.locator('#accountLoginButton').click();
    await new Promise(r => setTimeout(r, 10000));
    
    const url = page.url();
    console.log('After login URL:', url);
    
    if (url.includes('login')) {
      console.log('Login failed, trying to use API via browser session...');
      
      // Try making API calls from the browser context (which has the right IP)
      // First, get API key
      const apiKeyResult = await page.evaluate(async () => {
        try {
          const resp = await fetch('https://porkbun.com/api/json/v3/apiKey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              identity: 'helpsona.support@gmail.com',
              secret: '*R^,6Nc($8H7T*X'
            })
          });
          return await resp.text();
        } catch(e) {
          return 'Error: ' + e.message;
        }
      });
      console.log('API key result:', apiKeyResult.substring(0, 500));
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
