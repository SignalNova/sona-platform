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
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('Google sign-in URL:', page.url());
  
  // Find email input
  const emailInput = await page.$('input[type="email"], input[name="identifier"]');
  if (emailInput) {
    await emailInput.type('helpsona.support@gmail.com', { delay: 50 });
    console.log('Typed email');
    
    // Click Next
    await page.keyboard.press('Enter');
    console.log('Pressed Enter for email');
    await new Promise(r => setTimeout(r, 8000));
    
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    if (currentUrl.includes('rejected')) {
      console.log('Google rejected the login');
    } else {
      const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
      console.log('Body text (first 800):', bodyText.substring(0, 800));
      
      // Check for password input
      const passwordInput = await page.$('input[type="password"]');
      if (passwordInput) {
        console.log('Password input found!');
        await passwordInput.type('*R^,6Nc($8H7T*X', { delay: 50 });
        await page.keyboard.press('Enter');
        console.log('Submitted password');
        await new Promise(r => setTimeout(r, 10000));
        
        console.log('After login URL:', page.url());
        const afterText = await page.evaluate(() => document.body.innerText).catch(() => '');
        console.log('After login text (first 500):', afterText.substring(0, 500));
      } else {
        console.log('No password input found');
      }
    }
  } else {
    console.log('Email input not found');
  }

  await page.screenshot({ path: '/tmp/gmail_stealth2.png' });
  await browser.close();
})();
