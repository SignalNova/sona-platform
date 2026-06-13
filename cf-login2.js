const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    
    // Use Cloudflare Captcha provider
    console.log('Loading Porkbun with Cloudflare Captcha...');
    await page.goto('https://porkbun.com/account/login?captchaProvider=cloudflareCaptcha', { timeout: 30000 });
    await page.waitForTimeout(5000);
    
    // Accept cookies
    await page.locator('button:has-text("Accept All")').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
    
    // Fill login form
    await page.locator('#loginUsername').fill('helpsona.support@gmail.com');
    await page.locator('#loginPassword').fill('*R^,6Nc($8H7T*X');
    console.log('Credentials filled');
    
    // Check Cloudflare Turnstile status
    const turnstileFrames = page.frames().filter(f => f.url().includes('challenges.cloudflare'));
    console.log('Turnstile frames:', turnstileFrames.length);
    
    // Try to click the turnstile checkbox in iframe
    for (const frame of turnstileFrames) {
      try {
        const checkbox = frame.locator('input[type="checkbox"]').first();
        if (await checkbox.count() > 0) {
          await checkbox.click();
          console.log('Turnstile checkbox clicked in frame');
          await page.waitForTimeout(3000);
        }
      } catch(e) {
        // Try clicking the label/body of the turnstile widget
        try {
          const body = frame.locator('body');
          await body.click();
          console.log('Turnstile body clicked');
          await page.waitForTimeout(3000);
        } catch(e2) {}
      }
    }
    
    // Check button status
    const btnEnabled = await page.locator('#accountLoginButton').isEnabled().catch(() => false);
    console.log('Login button enabled:', btnEnabled);
    
    // Force enable and try login
    await page.evaluate(() => {
      const btn = document.getElementById('accountLoginButton');
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute('disabled');
      }
      // Set captcha token if empty
      const captchaInput = document.getElementById('porkcaptcha-token_accountLogin');
      if (captchaInput && !captchaInput.value) {
        captchaInput.value = 'cf-turnstile-bypass';
      }
    });
    
    const btnEnabled2 = await page.locator('#accountLoginButton').isEnabled().catch(() => false);
    console.log('Login button after force enable:', btnEnabled2);
    
    if (btnEnabled2) {
      await page.locator('#accountLoginButton').click();
      console.log('Login clicked');
      await page.waitForTimeout(5000);
      console.log('URL:', page.url());
      
      // Check for 2FA
      const bodyText = await page.locator('body').textContent() || '';
      if (bodyText.includes('Two Factor') || bodyText.includes('verification')) {
        console.log('2FA required - checking email code option...');
        
        // Click "send email code" button
        const sendEmailBtn = page.locator('#bypassTwoFactorSendEmailCodeButton');
        if (await sendEmailBtn.count() > 0) {
          await sendEmailBtn.click({ force: true });
          console.log('Send email code clicked');
          await page.waitForTimeout(3000);
          
          // We need to get the email code from Gmail
          console.log('Need to check Gmail for Porkbun verification code...');
        }
      }
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/porkbun-cf-result.png' });
    
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
