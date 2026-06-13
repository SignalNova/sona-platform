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
    
    // Try with just the email prefix as username
    await page.fill('#loginUsername', 'helpsona.support@gmail.com');
    await page.click('#loginPassword');
    await page.keyboard.type('*R^,6Nc($8H7T*X', { delay: 50 });
    
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
    
    // Check if 2FA is required
    const bodyText = await page.evaluate(() => document.body.innerText);
    
    // Check for 2FA elements
    const twoFA = await page.evaluate(() => {
      const inputs = ['twoFactorLoginCode', 'twoFactorLoginCodeEmail', 'bypassTwoFactorEmailCode'];
      return inputs.map(id => ({
        id,
        visible: document.getElementById(id)?.offsetParent !== null
      }));
    });
    console.log('2FA inputs:', JSON.stringify(twoFA));
    
    // Check the error message more carefully
    if (bodyText.includes('incorrect') || bodyText.includes('Invalid')) {
      console.log('WRONG CREDENTIALS');
    } else if (bodyText.includes('robot') || bodyText.includes('CAPTCHA')) {
      console.log('CAPTCHA ISSUE');
    } else if (bodyText.includes('two-factor') || bodyText.includes('2FA')) {
      console.log('2FA REQUIRED');
    } else {
      // Get all error/alert text
      const alerts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.alert, [class*="error"], [class*="notice"]'))
          .map(a => a.textContent.trim())
          .filter(t => t.length > 0 && t.length < 200);
      });
      console.log('Alerts:', alerts);
      
      // Check all visible text on the page
      const visible = await page.evaluate(() => {
        return document.body.innerText.substring(0, 3000);
      });
      
      if (visible.includes('unable to log you in')) {
        // Check if the robot message is also there
        if (visible.includes('robot') || visible.includes('robot')) {
          console.log('ROBOT DETECTED');
        } else {
          console.log('LOGIN FAILED - NOT ROBOT ISSUE - WRONG CREDS');
        }
      }
    }
    
  } catch(e) { 
    console.error('Error:', e.message); 
  } finally { 
    if(browser) await browser.close(); 
  }
})();
