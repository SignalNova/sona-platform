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
    
    // Step 2: Handle 2FA if present
    let currentUrl = page.url();
    console.log('After login URL:', currentUrl);
    
    const bodyText = await page.locator('body').textContent() || '';
    
    if (currentUrl.includes('two-factor') || bodyText.includes('Two-factor')) {
      console.log('2FA page detected!');
      
      // Try to use app authenticator code - look for the 2FA form
      const twoFAInput = page.locator('#two-factor-code, input[name="otp"], input[name="two-factor[code]"], input[type="tel"]').first();
      if (await twoFAInput.count() > 0) {
        console.log('Found 2FA input, checking type...');
        const inputType = await twoFAInput.getAttribute('type');
        const inputName = await twoFAInput.getAttribute('name');
        const inputId = await twoFAInput.getAttribute('id');
        console.log('2FA input details:', { type: inputType, name: inputName, id: inputId });
      }
      
      // Look for fallback / recovery options
      const fallbackLinks = await page.evaluate(() => {
        const links = document.querySelectorAll('a, button');
        return Array.from(links).map(l => ({ 
          text: l.textContent?.trim().substring(0, 60), 
          href: l.href || '',
          type: l.tagName 
        })).filter(l => l.text && (l.text.includes('email') || l.text.includes('SMS') || l.text.includes('recovery') || l.text.includes('fallback') || l.text.includes('resend')));
      });
      console.log('Fallback options:', JSON.stringify(fallbackLinks));
      
      // Take screenshot to see the 2FA page
      await page.screenshot({ path: '/home/z/my-project/download/github-2fa-page.png' });
      
      // Get more details about the page
      const visibleText = await page.evaluate(() => {
        const els = document.querySelectorAll('div, p, h1, h2, h3, label, span');
        return Array.from(els).filter(e => e.offsetParent !== null && e.textContent?.trim().length > 10 && e.textContent?.trim().length < 200).map(e => e.textContent?.trim()).slice(0, 20);
      });
      console.log('2FA page visible text:', JSON.stringify(visibleText));
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
