const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    
    // Go to Porkbun login
    console.log('Loading Porkbun login...');
    await page.goto('https://porkbun.com/account/login', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Accept cookies
    await page.locator('button:has-text("Accept All")').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    
    // Look for "Sign in with Google" button
    const pageText = await page.locator('body').textContent() || '';
    console.log('Looking for Google login option...');
    
    // Check for Google OAuth button
    const googleBtn = page.locator('button:has-text("Google"), a:has-text("Google"), [class*="google"], [id*="google"]').first();
    const hasGoogleBtn = await googleBtn.count() > 0;
    console.log('Google button found:', hasGoogleBtn);
    
    // List all visible buttons/links that might be OAuth
    const allLinks = await page.locator('a:visible, button:visible').all();
    console.log('All visible buttons/links:');
    for (const el of allLinks.slice(0, 30)) {
      const text = (await el.textContent() || '').trim().substring(0, 50);
      const href = await el.getAttribute('href') || '';
      const onclick = await el.getAttribute('onclick') || '';
      if (text || href) console.log('  -', text, '|', href.substring(0, 50), '|', onclick.substring(0, 50));
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/porkbun-all-buttons.png' });
    
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
