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
    
    // Step 1: Login to GitHub
    console.log('Step 1: Logging into GitHub...');
    await page.goto('https://github.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    
    await page.fill('#login_field', 'helpsona.support@gmail.com');
    await page.fill('#password', '*R^,6Nc($8H7T*X');
    await page.locator('input[type="submit"]').first().click();
    await new Promise(r => setTimeout(r, 10000));
    
    console.log('After login URL:', page.url());
    
    // Step 2: Navigate to device verification
    console.log('Step 2: Going to device verification page...');
    await page.goto('https://github.com/login/device', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Device page URL:', page.url());
    
    // Fill in the user code
    await page.fill('#user_code', 'CC1C-6617').catch(() => console.log('Could not fill user code'));
    await page.locator('button:has-text("Authorize"), button:has-text("Continue"), input[type="submit"]').first().click().catch(() => console.log('Could not click authorize'));
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('After authorize URL:', page.url());
    const bodyText = await page.locator('body').textContent() || '';
    console.log('Page text:', bodyText.substring(0, 500));
    
    await page.screenshot({ path: '/home/z/my-project/download/github-device.png' });
    
    // There might be a second confirmation step
    const confirmBtn = page.locator('button:has-text("Authorize"), button:has-text("Confirm")').first();
    if (await confirmBtn.count() > 0 && await confirmBtn.isVisible()) {
      await confirmBtn.click();
      await new Promise(r => setTimeout(r, 5000));
      console.log('Confirmation clicked');
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/github-device-final.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
