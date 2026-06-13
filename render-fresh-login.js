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
    
    // Login to Render
    console.log('Logging into Render...');
    await page.goto('https://dashboard.render.com/login', { waitUntil: 'networkidle', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // Accept cookies
    const acceptBtn = page.locator('button:has-text("Accept"), button:has-text("accept")').first();
    if (await acceptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acceptBtn.click({ force: true }).catch(() => {});
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // List all inputs
    const inputs = await page.locator('input:visible').all();
    console.log('Visible inputs:', inputs.length);
    for (const inp of inputs) {
      const type = await inp.getAttribute('type') || '';
      const name = await inp.getAttribute('name') || '';
      const id = await inp.getAttribute('id') || '';
      console.log(`  input: type=${type} name=${name} id=${id}`);
    }
    
    // Fill login form
    await page.locator('input[type="email"]').first().fill('helpsona.support@gmail.com').catch(() => console.log('email fill failed'));
    await page.locator('input[type="password"]').first().fill('*R^,6Nc($8H7T*X').catch(() => console.log('pass fill failed'));
    console.log('Login form filled');
    
    // Click login button
    const loginBtn = page.locator('button:has-text("Log In"), button:has-text("Sign In"), button[type="submit"]').first();
    await loginBtn.click().catch(() => console.log('button click failed'));
    await new Promise(r => setTimeout(r, 10000));
    
    console.log('After login URL:', page.url());
    
    // Get auth token
    const auth = await page.evaluate(() => localStorage.getItem('render-auth')).catch(() => null);
    if (auth) {
      const parsed = JSON.parse(auth);
      console.log('GOT TOKEN:', parsed.idToken);
      fs.writeFileSync('/home/z/my-project/render-fresh-token.txt', parsed.idToken);
    } else {
      console.log('No auth token, checking page...');
      const body = await page.locator('body').textContent() || '';
      console.log('Page snippet:', body.substring(0, 300));
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/render-login-final.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
