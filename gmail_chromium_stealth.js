const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080'
    ]
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US'
  });
  
  // Anti-detection scripts
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    // Override chrome runtime
    window.chrome = { runtime: {} };
    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });
  
  const page = await context.newPage();

  // Try Google sign-in
  await page.goto('https://accounts.google.com/v3/signin/identifier?continue=https%3A%2F%2Fmail.google.com%2Fmail%2Fu%2F0%2F&service=mail&flowName=GlifWebSignIn&flowEntry=ServiceLogin', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));
  
  console.log('URL:', page.url());
  
  const emailInput = page.locator('input[type="email"], input[name="identifier"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill('helpsona.support@gmail.com');
    console.log('Filled email');
    
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 8000));
    
    const currentUrl = page.url();
    console.log('URL after Next:', currentUrl);
    
    if (currentUrl.includes('rejected')) {
      console.log('Google STILL rejected the login with Chromium + stealth');
    } else {
      console.log('Google did NOT reject - progress!');
      const bodyText = await page.innerText('body').catch(() => '');
      console.log('Body text (first 800):', bodyText.substring(0, 800));
      
      const passwordInput = page.locator('input[type="password"]').first();
      if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Password input found!');
      }
    }
  }

  await page.screenshot({ path: '/tmp/gmail_chromium_stealth.png' });
  await browser.close();
})();
