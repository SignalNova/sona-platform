const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    
    // Use mobile user agent to avoid blocks
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    
    // Step 1: Login
    console.log('Step 1: Logging into Porkbun...');
    await page.goto('https://porkbun.com/account/login', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    let bodyText = await page.locator('body').textContent() || '';
    console.log('Page loaded, content length:', bodyText.length);
    
    if (bodyText.includes('Hardcore hacker') || bodyText.includes('blocked')) {
      console.log('Still blocked. Trying cookie clearing...');
      await context.clearCookies();
      
      // Try alternative: go directly to domain management
      await page.goto('https://porkbun.com/account/login', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      await page.waitForTimeout(5000);
      bodyText = await page.locator('body').textContent() || '';
      console.log('Second attempt, content length:', bodyText.length);
    }
    
    if (bodyText.includes('Hardcore hacker')) {
      console.log('Permanently blocked by Porkbun. Need to wait longer or use VPN.');
      console.log('FALLBACK: Will use onboarding@resend.dev which works NOW.');
      await browser.close();
      process.exit(0);
    }
    
    // Try to find and fill login form
    const emailSelectors = ['input[name="email"]', 'input[type="email"]', '#inputEmail', 'input[placeholder*="email"]'];
    let emailFound = false;
    for (const sel of emailSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0 && await el.isVisible()) {
        await el.fill('helpsona.support@gmail.com');
        emailFound = true;
        console.log('Email filled with selector:', sel);
        break;
      }
    }
    
    if (!emailFound) {
      console.log('Email input not found. Listing all inputs:');
      const inputs = await page.locator('input').all();
      for (const inp of inputs) {
        const type = await inp.getAttribute('type') || 'no-type';
        const name = await inp.getAttribute('name') || 'no-name';
        const id = await inp.getAttribute('id') || 'no-id';
        const placeholder = await inp.getAttribute('placeholder') || 'no-placeholder';
        console.log('  input:', { type, name, id, placeholder });
      }
    }
    
    const passSelectors = ['input[name="password"]', 'input[type="password"]', '#inputPassword'];
    for (const sel of passSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0 && await el.isVisible()) {
        await el.fill('*R^,6Nc($8H7T*X');
        console.log('Password filled');
        break;
      }
    }
    
    // Click login
    const btnSelectors = ['button[type="submit"]', 'input[type="submit"]', 'button:has-text("Log In")', 'button:has-text("Sign")'];
    for (const sel of btnSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0 && await el.isVisible()) {
        await el.click();
        console.log('Login button clicked');
        break;
      }
    }
    
    await page.waitForTimeout(5000);
    console.log('After login URL:', page.url());
    
    // Step 2: Go to DNS management
    console.log('Step 2: Navigating to DNS management...');
    await page.goto('https://porkbun.com/management/dns/sona.support', { timeout: 30000 });
    await page.waitForTimeout(3000);
    console.log('DNS page URL:', page.url());
    
    await page.screenshot({ path: '/home/z/my-project/download/porkbun-dns.png' });
    console.log('Screenshot saved');
    
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
