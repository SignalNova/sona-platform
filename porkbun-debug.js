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
    
    console.log('Loading Porkbun login...');
    await page.goto('https://porkbun.com/account/login?captchaProvider=cloudflareCaptcha', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));
    
    await page.evaluate(() => { if (typeof cookieBannerSave === 'function') cookieBannerSave(true, true); }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));
    
    // Fill login
    await page.fill('#loginUsername', 'helpsona.support@gmail.com');
    await page.fill('#loginPassword', '*R^,6Nc($8H7T*X');
    
    // Wait for Turnstile
    await new Promise(r => setTimeout(r, 15000));
    
    // Click login
    await page.locator('#accountLoginButton').click();
    await new Promise(r => setTimeout(r, 10000));
    
    // Get all visible error messages
    const errorInfo = await page.evaluate(() => {
      const alerts = document.querySelectorAll('.alert, [class*="error"], [class*="Error"], [class*="alert"], [role="alert"]');
      const results = [];
      alerts.forEach(a => {
        if (a.textContent?.trim() && a.offsetParent !== null) {
          results.push(a.textContent.trim());
        }
      });
      return results;
    });
    console.log('Error messages:', JSON.stringify(errorInfo));
    
    // Get all visible text
    const visibleText = await page.evaluate(() => {
      const elements = document.querySelectorAll('div, p, span, h1, h2, h3, h4, label, button');
      const results = [];
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 5 && text.length < 200 && el.offsetParent !== null) {
          results.push(text);
        }
      });
      return [...new Set(results)].slice(0, 40);
    });
    console.log('Visible text:', JSON.stringify(visibleText, null, 2));
    
    // Check for 2FA form
    const twoFA = await page.evaluate(() => {
      const inputs = document.querySelectorAll('#twoFactorLoginCode, #twoFactorLoginCodeEmail, #bypassTwoFactorEmailCode');
      return Array.from(inputs).map(i => ({ id: i.id, visible: i.offsetParent !== null, type: i.type }));
    });
    console.log('2FA inputs:', JSON.stringify(twoFA));
    
    await page.screenshot({ path: '/home/z/my-project/download/porkbun-debug.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
