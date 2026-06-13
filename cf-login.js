const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    
    // Use Cloudflare Captcha provider (might be easier to solve)
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
    
    // Check if login button is enabled now
    const btnEnabled = await page.locator('#accountLoginButton').isEnabled().catch(() => false);
    console.log('Login button enabled:', btnEnabled);
    
    // Screenshot to see current state
    await page.screenshot({ path: '/home/z/my-project/download/porkbun-cf-captcha.png' });
    
    // Try to solve the Cloudflare Turnstile challenge
    // Check for iframe
    const frames = page.frames();
    console.log('Frames:', frames.length);
    for (const frame of frames) {
      console.log('  Frame URL:', frame.url().substring(0, 100));
    }
    
    // Look for the turnstile checkbox
    const turnstileFrame = page.frameLocator('iframe[src*="challenges.cloudflare"]');
    const checkbox = turnstileFrame.locator('#challenge-stage input[type="checkbox"], .cb-lb').first();
    const hasCheckbox = await checkbox.count().catch(() => 0);
    console.log('Turnstile checkbox found:', hasCheckbox > 0);
    
    if (hasCheckbox > 0) {
      await checkbox.click().catch(() => {});
      console.log('Turnstile checkbox clicked');
      await page.waitForTimeout(3000);
    }
    
    // Check if button is enabled after solving turnstile
    const btnEnabled2 = await page.locator('#accountLoginButton').isEnabled().catch(() => false);
    console.log('Login button enabled after turnstile:', btnEnabled2);
    
    if (btnEnabled2) {
      await page.locator('#accountLoginButton').click();
      console.log('Login button clicked!');
      await page.waitForTimeout(5000);
      console.log('URL after login:', page.url());
      
      // If logged in, go to DNS management
      if (!page.url().includes('login')) {
        console.log('SUCCESS! Going to DNS...');
        await page.goto('https://porkbun.com/management/dns/sona.support', { timeout: 30000 });
        await page.waitForTimeout(3000);
        console.log('DNS page URL:', page.url());
        
        // Add DKIM record
        console.log('Adding DKIM TXT record...');
        // Find and click "Add" button
        const addRecordBtn = page.locator('button:has-text("Add"), a:has-text("Add")').first();
        if (await addRecordBtn.count() > 0) {
          await addRecordBtn.click();
          await page.waitForTimeout(1000);
          
          // Fill DNS record form
          const typeSelect = page.locator('select[name="type"], select[id*="type"]').first();
          if (await typeSelect.count() > 0) {
            await typeSelect.selectOption('TXT');
          }
          
          const nameInput = page.locator('input[name="name"], input[id*="name"]').first();
          if (await nameInput.count() > 0) {
            await nameInput.fill('resend._domainkey');
          }
          
          const contentInput = page.locator('input[name="content"], input[name="answer"], textarea[name="content"]').first();
          if (await contentInput.count() > 0) {
            await contentInput.fill('p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCzo7M5wZMqAvNmDKUPZbw1zOYfqx7HbSrfxXmYVuj+U7LwRXdTCIsw8MEJ9BqyLtZBjrvAFkOa9zG7pMFQLrI7kpW+baVO+CCNIIY2xG/aPcWU5iusrJRg+T6tQ2xHSBhq3N6IMp9VFAKlYCKCm/Jnb3Nzq5/7KTA2r709NqE1dwIDAQAB');
          }
          
          console.log('DKIM form filled');
        }
      }
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/porkbun-result.png' });
    
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
