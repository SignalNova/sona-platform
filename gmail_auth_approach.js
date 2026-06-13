const { firefox } = require('playwright');

(async () => {
  const browser = await firefox.launch({ 
    headless: true
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0',
    viewport: { width: 1920, height: 1080 }
  });
  
  // First, let me try Google sign-in through YouTube
  const page = await context.newPage();
  
  // Try Google sign-in through a different entry point
  console.log('Trying Google sign-in through myaccount...');
  await page.goto('https://myaccount.google.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));
  
  const url1 = page.url();
  console.log('URL:', url1);
  
  if (url1.includes('accounts.google.com') || url1.includes('ServiceLogin')) {
    // Try to sign in
    const emailInput = page.locator('input[type="email"], input[name="identifier"]').first();
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill('helpsona.support@gmail.com');
      console.log('Filled email');
      
      // Try clicking Next
      try {
        const nextBtn = page.locator('#identifierNext, button:has-text("Next"), div[role=button]:has-text("Next")').first();
        await nextBtn.click();
        console.log('Clicked Next');
        await new Promise(r => setTimeout(r, 8000));
        
        const url2 = page.url();
        console.log('URL after Next:', url2);
        
        if (url2.includes('rejected')) {
          console.log('Google rejected sign-in');
        } else {
          const bodyText = await page.innerText('body').catch(() => '');
          console.log('Body text (first 500):', bodyText.substring(0, 500));
        }
      } catch(e) {
        console.log('Error clicking Next:', e.message.substring(0, 100));
      }
    }
  }
  
  await browser.close();
})();
