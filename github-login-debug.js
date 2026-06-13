const { firefox } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await firefox.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0',
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    
    console.log('Loading GitHub login...');
    await page.goto('https://github.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    
    await page.fill('#login_field', 'helpsona.support@gmail.com');
    await page.fill('#password', '*R^,6Nc($8H7T*X');
    await page.locator('input[type="submit"]').first().click();
    await new Promise(r => setTimeout(r, 10000));
    
    const url = page.url();
    console.log('URL after login attempt:', url);
    
    const body = await page.locator('body').textContent() || '';
    
    if (url.includes('two-factor')) {
      console.log('2FA REQUIRED - password is correct!');
      console.log('We need the 2FA code from the authenticator app');
    } else if (url.includes('session')) {
      // Check if there's an error
      if (body.includes('Incorrect') || body.includes('invalid') || body.includes('wrong')) {
        console.log('WRONG PASSWORD');
      } else {
        console.log('Session page - may be 2FA redirect');
        // Extract flash messages
        const flashMsg = await page.evaluate(() => {
          const flashes = document.querySelectorAll('.flash-error, .flash-warn, .flash-success, [class*="flash"]');
          return Array.from(flashes).map(f => f.textContent?.trim());
        });
        console.log('Flash messages:', flashMsg);
      }
    } else if (url === 'https://github.com/' || url.includes('dashboard')) {
      console.log('LOGGED IN SUCCESSFULLY!');
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/github-login-debug.png' });
    console.log('Body snippet:', body.substring(0, 800));
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
