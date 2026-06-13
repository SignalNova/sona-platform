const { firefox } = require('playwright');

(async () => {
  const browser = await firefox.launch({ 
    headless: true
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
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
      console.log('Google rejected the login');
    } else {
      const bodyText = await page.innerText('body').catch(() => '');
      console.log('Body text (first 500):', bodyText.substring(0, 500));
      
      // Try password
      const passwordInput = page.locator('input[type="password"]').first();
      if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Password input found!');
        await passwordInput.fill('*R^,6Nc($8H7T*X');
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 10000));
        
        console.log('After login URL:', page.url());
        const afterText = await page.innerText('body').catch(() => '');
        console.log('After login text (first 500):', afterText.substring(0, 500));
      }
    }
  }

  await page.screenshot({ path: '/tmp/gmail_windows_ua.png' });
  await browser.close();
})();
