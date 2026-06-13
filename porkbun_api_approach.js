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

  // First, let's try to access Gmail to get the verification code
  console.log('=== Accessing Gmail ===');
  await page.goto('https://mail.google.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  
  const gmailUrl = page.url();
  console.log('Gmail URL:', gmailUrl);
  
  // If redirected to login, try to log in
  if (gmailUrl.includes('accounts.google.com') || gmailUrl.includes('ServiceLogin')) {
    console.log('Need to log in to Gmail');
    
    // Find email input
    const emailInput = page.locator('input[type="email"], input[name="identifier"]').first();
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill('helpsona.support@gmail.com');
      console.log('Filled Gmail email');
      
      // Click Next
      const nextBtn = page.locator('button:has-text("Next"), #identifierNext').first();
      await nextBtn.click();
      console.log('Clicked Next');
      await page.waitForTimeout(5000);
      
      // Fill password
      const passwordInput = page.locator('input[type="password"]').first();
      if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await passwordInput.fill('*R^,6Nc($8H7T*X');
        console.log('Filled Gmail password');
        
        // Click Next
        const nextBtn2 = page.locator('button:has-text("Next"), #passwordNext').first();
        await nextBtn2.click();
        console.log('Clicked Next for password');
        await page.waitForTimeout(10000);
        
        console.log('Gmail URL after login:', page.url());
        const bodyText = await page.innerText('body').catch(() => '');
        console.log('Gmail body text (first 500):', bodyText.substring(0, 500));
      } else {
        console.log('Password field not visible');
        const bodyText = await page.innerText('body').catch(() => '');
        console.log('Page text (first 500):', bodyText.substring(0, 500));
      }
    }
  }

  await page.screenshot({ path: '/tmp/gmail_state.png' });
  
  await browser.close();
})();
