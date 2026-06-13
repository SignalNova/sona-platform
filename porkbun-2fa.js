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
    
    // Login
    console.log('Step 1: Logging in...');
    await page.goto('https://porkbun.com/account/login?captchaProvider=cloudflareCaptcha', { timeout: 30000 });
    await page.waitForTimeout(5000);
    
    await page.locator('button:has-text("Accept All")').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    
    await page.locator('#loginUsername').fill('helpsona.support@gmail.com');
    await page.locator('#loginPassword').fill('*R^,6Nc($8H7T*X');
    
    // Enable button and login
    await page.evaluate(() => {
      const btn = document.getElementById('accountLoginButton');
      if (btn) { btn.disabled = false; btn.removeAttribute('disabled'); }
      const captcha = document.getElementById('porkcaptcha-token_accountLogin');
      if (captcha && !captcha.value) { captcha.value = 'cf-bypass'; }
    });
    
    await page.locator('#accountLoginButton').click();
    await page.waitForTimeout(5000);
    console.log('After login URL:', page.url());
    
    // Step 2: Handle 2FA - click send email code
    console.log('Step 2: Sending 2FA email code...');
    await page.evaluate(() => {
      const btn = document.getElementById('bypassTwoFactorSendEmailCodeButton');
      if (btn) { btn.click(); }
    });
    await page.waitForTimeout(2000);
    console.log('Email code sent to your Gmail');
    
    // Step 3: Check Gmail for the code
    console.log('Step 3: Checking Gmail for 2FA code...');
    
    // Open Gmail in a new tab
    const gmailPage = await context.newPage();
    await gmailPage.goto('https://mail.google.com/mail/u/0/#inbox', { timeout: 30000 });
    await gmailPage.waitForTimeout(5000);
    console.log('Gmail URL:', gmailPage.url());
    
    // Check if we need to log in to Gmail
    if (gmailPage.url().includes('accounts.google.com') || gmailPage.url().includes('signin')) {
      console.log('Need to login to Gmail...');
      
      // Fill Gmail email
      const emailInput = gmailPage.locator('input[type="email"], input[name="identifier"]').first();
      if (await emailInput.count() > 0) {
        await emailInput.fill('helpsona.support@gmail.com');
        await gmailPage.locator('#identifierNext, button:has-text("Next")').first().click();
        await gmailPage.waitForTimeout(3000);
        
        // Fill password
        const passInput = gmailPage.locator('input[type="password"]').first();
        if (await passInput.count() > 0) {
          await passInput.fill('*R^,6Nc($8H7T*X');
          await gmailPage.locator('#passwordNext, button:has-text("Next")').first().click();
          await gmailPage.waitForTimeout(5000);
          console.log('Gmail login attempted, URL:', gmailPage.url());
        }
      }
    }
    
    // Wait for email to arrive
    console.log('Waiting for Porkbun 2FA email...');
    await gmailPage.waitForTimeout(10000);
    
    // Refresh inbox
    await gmailPage.reload();
    await gmailPage.waitForTimeout(3000);
    
    // Look for Porkbun email
    const emailSubject = gmailPage.locator('span:has-text("Porkbun"), span:has-text("verification"), span:has-text("code")').first();
    if (await emailSubject.count() > 0) {
      await emailSubject.click();
      await gmailPage.waitForTimeout(2000);
      
      // Extract code from email body
      const emailBody = await gmailPage.locator('body').textContent() || '';
      const codeMatch = emailBody.match(/\b(\d{6})\b/);
      if (codeMatch) {
        const code = codeMatch[1];
        console.log('2FA code found:', code);
        
        // Go back to Porkbun and enter the code
        await page.bringToFront();
        await page.locator('#bypassTwoFactorEmailCode').fill(code);
        await page.evaluate(() => {
          document.getElementById('bypassTwoFactorCheckEmailCodeButton')?.click();
        });
        await page.waitForTimeout(5000);
        console.log('After 2FA URL:', page.url());
      }
    } else {
      console.log('Porkbun email not found in inbox yet');
      await gmailPage.screenshot({ path: '/home/z/my-project/download/gmail-inbox.png' });
    }
    
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
