const { firefox } = require('playwright');

(async () => {
  const browser = await firefox.launch({ 
    headless: true
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0',
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();

  // Try Google sign-in with a different approach
  // Use the Google accounts page directly
  await page.goto('https://accounts.google.com/signin', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  console.log('Google sign-in URL:', page.url());
  const bodyText = await page.innerText('body').catch(() => '');
  console.log('Google sign-in text (first 500):', bodyText.substring(0, 500));
  
  // Find the email input
  const emailInput = page.locator('input[type="email"], input[name="identifier"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill('helpsona.support@gmail.com');
    console.log('Filled email');
    
    // Click Next
    const nextBtn = page.locator('#identifierNext, button:has-text("Next")').first();
    await nextBtn.click();
    console.log('Clicked Next');
    await page.waitForTimeout(8000);
    
    // Check what's on the page now
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    const currentText = await page.innerText('body').catch(() => '');
    console.log('Current text (first 800):', currentText.substring(0, 800));
    
    // Try to find password input
    const passwordInput = page.locator('input[type="password"]').first();
    if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Password input found!');
      await passwordInput.fill('*R^,6Nc($8H7T*X');
      console.log('Filled password');
      
      const nextBtn2 = page.locator('#passwordNext, button:has-text("Next")').first();
      await nextBtn2.click();
      console.log('Clicked Next for password');
      await page.waitForTimeout(10000);
      
      console.log('After password URL:', page.url());
      const afterText = await page.innerText('body').catch(() => '');
      console.log('After password text (first 500):', afterText.substring(0, 500));
    } else {
      console.log('Password input not found');
      // Maybe there's a challenge or the browser is not secure
      const challengeText = await page.innerText('body').catch(() => '');
      console.log('Challenge text (first 800):', challengeText.substring(0, 800));
    }
  }

  await page.screenshot({ path: '/tmp/gmail_login_attempt.png' });
  await browser.close();
})();
