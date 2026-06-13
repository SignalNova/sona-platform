const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    
    // Step 1: Login to GitHub
    console.log('Step 1: Logging into GitHub...');
    await page.goto('https://github.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // Fill login form
    await page.fill('#login_field', 'helpsona.support@gmail.com');
    await page.fill('#password', '*R^,6Nc($8H7T*X');
    
    // Submit
    await page.locator('input[type="submit"]').first().click();
    await new Promise(r => setTimeout(r, 10000));
    
    let url = page.url();
    console.log('After login URL:', url);
    
    // Check for 2FA page
    const bodyText = await page.locator('body').textContent() || '';
    if (url.includes('two-factor') || bodyText.includes('Two-factor')) {
      console.log('2FA PAGE DETECTED - checking for authenticator input...');
      
      // Get the 2FA form details
      const otpInput = page.locator('input[name="otp"], input[id="otp"], input[type="tel"]').first();
      if (await otpInput.count() > 0) {
        console.log('Found OTP input');
        const inputType = await otpInput.getAttribute('type');
        const inputPlaceholder = await otpInput.getAttribute('placeholder');
        console.log('OTP input type:', inputType, 'placeholder:', inputPlaceholder);
      }
      
      // Check for SMS fallback
      const smsLink = page.locator('button:has-text("SMS"), a:has-text("SMS"), button:has-text("text")').first();
      if (await smsLink.count() > 0) {
        console.log('SMS fallback available');
      }
      
      // Check for recovery code option  
      const recoveryLink = page.locator('button:has-text("recovery"), a:has-text("recovery"), button:has-text("Recovery")').first();
      if (await recoveryLink.count() > 0) {
        console.log('Recovery code option available');
      }
      
      // List all interactive elements on 2FA page
      const elements = await page.evaluate(() => {
        const btns = document.querySelectorAll('button, a, input[type="submit"]');
        return Array.from(btns).filter(b => b.offsetParent !== null).map(b => ({
          tag: b.tagName,
          text: b.textContent?.trim().substring(0, 60),
          type: b.getAttribute('type'),
          href: b.getAttribute('href')
        }));
      });
      console.log('2FA page elements:', JSON.stringify(elements, null, 2));
      
      await page.screenshot({ path: '/home/z/my-project/download/github-2fa.png' });
    } else if (url.includes('session')) {
      console.log('Login may have failed - still on session page');
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
