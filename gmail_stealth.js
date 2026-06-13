const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Try Google sign-in
  await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForTimeout(3000);
  
  console.log('Google sign-in URL:', page.url());
  
  // Find email input
  const emailInput = await page.$('input[type="email"], input[name="identifier"]');
  if (emailInput) {
    await emailInput.type('helpsona.support@gmail.com', { delay: 50 });
    console.log('Typed email');
    
    // Click Next
    const nextBtn = await page.$('#identifierNext, button:has-text("Next")');
    if (nextBtn) {
      await nextBtn.click();
      console.log('Clicked Next');
      await page.waitForTimeout(8000);
      
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);
      
      if (currentUrl.includes('rejected')) {
        console.log('Google still rejected the login');
      } else {
        const currentText = await page.evaluate(() => document.body.innerText).catch(() => '');
        console.log('Current text (first 500):', currentText.substring(0, 500));
        
        // Try password
        const passwordInput = await page.$('input[type="password"]');
        if (passwordInput) {
          console.log('Password input found!');
          await passwordInput.type('*R^,6Nc($8H7T*X', { delay: 50 });
          
          const nextBtn2 = await page.$('#passwordNext');
          if (nextBtn2) {
            await nextBtn2.click();
            console.log('Clicked Next for password');
            await page.waitForTimeout(10000);
            
            console.log('After login URL:', page.url());
          }
        } else {
          console.log('Password input not found');
          const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
          console.log('Body text (first 500):', bodyText.substring(0, 500));
        }
      }
    }
  } else {
    console.log('Email input not found');
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
    console.log('Body text (first 500):', bodyText.substring(0, 500));
  }

  await page.screenshot({ path: '/tmp/gmail_stealth.png' });
  await browser.close();
})();
