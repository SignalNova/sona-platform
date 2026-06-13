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
    
    console.log('Loading Render login...');
    await page.goto('https://dashboard.render.com/login', { waitUntil: 'networkidle', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // Accept cookies if dialog present
    await page.locator('button:has-text("Accept")').first().click().catch(() => {});
    await new Promise(r => setTimeout(r, 1000));
    
    // List all inputs
    const inputs = await page.locator('input').all();
    console.log('Found', inputs.length, 'inputs');
    for (const inp of inputs) {
      const type = await inp.getAttribute('type') || 'no-type';
      const name = await inp.getAttribute('name') || 'no-name';
      const id = await inp.getAttribute('id') || 'no-id';
      const visible = await inp.isVisible().catch(() => false);
      if (visible) console.log(`  visible: type=${type} name=${name} id=${id}`);
    }
    
    // Fill email
    const emailSel = 'input[type="email"], input[name="email"], input[id="email"], input[placeholder*="email"]';
    await page.locator(emailSel).first().fill('helpsona.support@gmail.com').catch(() => console.log('Email fill failed'));
    console.log('Email filled');
    
    // Fill password
    const passSel = 'input[type="password"], input[name="password"]';
    await page.locator(passSel).first().fill('*R^,6Nc($8H7T*X').catch(() => console.log('Pass fill failed'));
    console.log('Password filled');
    
    // Click login
    await page.locator('button:has-text("Log"), button[type="submit"]').first().click().catch(() => console.log('Click failed'));
    console.log('Login clicked');
    
    await new Promise(r => setTimeout(r, 10000));
    console.log('After login URL:', page.url());
    
    // Get auth
    const auth = await page.evaluate(() => localStorage.getItem('render-auth')).catch(() => null);
    if (auth) {
      const parsed = JSON.parse(auth);
      console.log('TOKEN:', parsed.idToken);
      require('fs').writeFileSync('/home/z/my-project/render-token.txt', parsed.idToken);
    } else {
      console.log('No auth token found');
      await page.screenshot({ path: '/home/z/my-project/download/render-login-fail.png' });
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
