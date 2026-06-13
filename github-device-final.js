const { chromium } = require('playwright');

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
    
    await page.fill('#login_field', 'helpsona.support@gmail.com');
    await page.fill('#password', '*R^,6Nc($8H7T*X');
    
    // Click the submit button
    const submitBtn = page.locator('input[type="submit"], button[type="submit"]').first();
    await submitBtn.click();
    await new Promise(r => setTimeout(r, 10000));
    
    let url = page.url();
    console.log('After login URL:', url);
    
    // If we're on 2FA page, we need to handle it
    if (url.includes('two-factor')) {
      console.log('2FA page - need to enter code');
      // We can't proceed without the 2FA code
    }
    
    // Step 2: Navigate to device verification (even if 2FA required, try directly)
    console.log('Step 2: Going to device verification...');
    await page.goto('https://github.com/login/device', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    url = page.url();
    console.log('Device page URL:', url);
    
    if (!url.includes('login') || url.includes('device')) {
      // Fill the user code
      const codeInput = page.locator('input#user_code, input[name="user_code"]').first();
      if (await codeInput.count() > 0) {
        await codeInput.fill('4A7A-1070');
        console.log('User code filled');
        
        // Click authorize/continue
        const authBtn = page.locator('button:has-text("Continue"), button:has-text("Authorize"), input[type="submit"]').first();
        await authBtn.click().catch(() => {});
        await new Promise(r => setTimeout(r, 5000));
        
        // May need another confirmation
        const confirmBtn = page.locator('button:has-text("Authorize"), button:has-text("Confirm")').first();
        if (await confirmBtn.count() > 0 && await confirmBtn.isVisible()) {
          await confirmBtn.click();
          await new Promise(r => setTimeout(r, 3000));
          console.log('Authorization confirmed');
        }
        
        console.log('Device authorized!');
      } else {
        console.log('Code input not found');
        const inputs = await page.locator('input').all();
        for (const inp of inputs) {
          const type = await inp.getAttribute('type') || 'no-type';
          const name = await inp.getAttribute('name') || 'no-name';
          const visible = await inp.isVisible().catch(() => false);
          console.log(`  input: type=${type} name=${name} visible=${visible}`);
        }
      }
    } else {
      console.log('Redirected to login - need 2FA first');
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/github-device-flow.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
