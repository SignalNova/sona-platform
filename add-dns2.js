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
    
    // Use Cloudflare Turnstile instead of Porkbun CAPTCHA
    console.log('Loading Porkbun with Cloudflare Turnstile...');
    await page.goto('https://porkbun.com/account/login?captchaProvider=cloudflareCaptcha', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));
    
    // Accept cookies via JS
    await page.evaluate(() => { if (typeof cookieBannerSave === 'function') cookieBannerSave(true, true); }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));
    
    // Fill login
    await page.fill('#loginUsername', 'helpsona.support@gmail.com');
    await page.fill('#loginPassword', '*R^,6Nc($8H7T*X');
    console.log('Credentials filled');
    
    // Wait for Turnstile to auto-solve
    console.log('Waiting for Turnstile to solve...');
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const btnEnabled = await page.evaluate(() => {
        const btn = document.getElementById('accountLoginButton');
        return btn && !btn.disabled;
      });
      console.log(`Wait ${i+1}: button enabled = ${btnEnabled}`);
      if (btnEnabled) break;
    }
    
    // Click login
    await page.locator('#accountLoginButton').click();
    console.log('Login clicked');
    await new Promise(r => setTimeout(r, 10000));
    
    const url = page.url();
    console.log('After login URL:', url);
    const body = await page.locator('body').textContent() || '';
    
    if (body.includes('unable to log you in')) {
      console.log('LOGIN FAILED');
    } else if (!url.includes('login')) {
      console.log('LOGGED IN!');
    } else {
      console.log('Still on login page, body snippet:', body.substring(0, 300));
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/porkbun-cf-login.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
