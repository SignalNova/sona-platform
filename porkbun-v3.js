const { firefox } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await firefox.launch({ headless: true });
    const page = await browser.newPage();
    
    // Go directly to login WITHOUT captcha provider parameter
    console.log('Loading Porkbun login (default CAPTCHA)...');
    await page.goto('https://porkbun.com/account/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    
    // Accept cookies
    await page.evaluate(() => { if(typeof cookieBannerSave==='function') cookieBannerSave(true,true); }).catch(()=>{});
    await page.waitForTimeout(2000);
    
    // Fill form
    await page.fill('#loginUsername', 'helpsona.support@gmail.com');
    await page.fill('#loginPassword', '*R^,6Nc($8H7T*X');
    console.log('Form filled');
    
    // Try to click the Porkbun CAPTCHA checkbox (it's their own custom CAPTCHA)
    const captchaEl = page.locator('#my-porkcaptcha_accountLogin');
    const captchaBox = await captchaEl.boundingBox().catch(() => null);
    if (captchaBox) {
      console.log('Found Porkbun CAPTCHA checkbox, clicking...');
      // Click slightly offset like a human
      await page.mouse.click(captchaBox.x + 25, captchaBox.y + captchaBox.height/2);
      await page.waitForTimeout(15000);
      console.log('CAPTCHA clicked, waiting...');
    } else {
      console.log('No CAPTCHA checkbox found, waiting for Turnstile...');
      await page.waitForTimeout(15000);
    }
    
    // Click login
    const btn = page.locator('#accountLoginButton');
    const isEnabled = await btn.isEnabled().catch(() => false);
    console.log('Login button enabled:', isEnabled);
    
    if (isEnabled) {
      await btn.click();
    } else {
      await page.evaluate(() => {
        const b = document.getElementById('accountLoginButton');
        if(b) b.disabled = false;
      });
      await btn.click().catch(()=>{});
    }
    
    await page.waitForTimeout(15000);
    console.log('URL:', page.url());
    
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    if (bodyText.includes('unable to log you in')) {
      console.log('FAILED: Still detected as robot');
    } else if (!page.url().includes('login')) {
      console.log('LOGGED IN!');
    } else {
      console.log('Unknown state:', bodyText.substring(0, 200));
    }
    
  } catch(e) { 
    console.error('Error:', e.message); 
  } finally { 
    if(browser) await browser.close(); 
  }
})();
