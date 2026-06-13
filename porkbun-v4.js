const { firefox } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await firefox.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log('Loading Porkbun...');
    await page.goto('https://porkbun.com/account/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.evaluate(() => { if(typeof cookieBannerSave==='function') cookieBannerSave(true,true); }).catch(()=>{});
    await page.waitForTimeout(2000);
    
    // Type the password character by character
    await page.fill('#loginUsername', 'helpsona.support@gmail.com');
    
    // Clear and type password manually
    await page.click('#loginPassword');
    await page.keyboard.type('*R^,6Nc($8H7T*X', { delay: 50 });
    
    // Verify what was typed
    const passValue = await page.evaluate(() => document.getElementById('loginPassword').value);
    console.log('Password field value:', passValue);
    console.log('Expected:          ', '*R^,6Nc($8H7T*X');
    console.log('Match:', passValue === '*R^,6Nc($8H7T*X');
    
    // Click CAPTCHA
    const captchaEl = page.locator('#my-porkcaptcha_accountLogin');
    const captchaBox = await captchaEl.boundingBox().catch(() => null);
    if (captchaBox) {
      await page.mouse.click(captchaBox.x + 25, captchaBox.y + captchaBox.height/2);
      await page.waitForTimeout(15000);
    }
    
    // Click login
    await page.click('#accountLoginButton').catch(()=>{});
    await page.waitForTimeout(15000);
    
    const url = page.url();
    console.log('URL:', url);
    
    const err = await page.evaluate(() => {
      const alerts = document.querySelectorAll('.alert, [class*="error"]');
      return Array.from(alerts).map(a => a.textContent.trim()).filter(t => t);
    });
    console.log('Errors:', err);
    
  } catch(e) { 
    console.error('Error:', e.message); 
  } finally { 
    if(browser) await browser.close(); 
  }
})();
