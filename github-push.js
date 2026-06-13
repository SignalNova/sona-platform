const { firefox } = require('playwright');
const fs = require('fs');

(async () => {
  let browser;
  try {
    browser = await firefox.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0',
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    
    // Login to GitHub
    console.log('Logging into GitHub...');
    await page.goto('https://github.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    
    await page.fill('#login_field', 'helpsona.support@gmail.com');
    await page.fill('#password', '*R^,6Nc($8H7T*X');
    await page.locator('input[type="submit"]').first().click();
    await new Promise(r => setTimeout(r, 10000));
    
    console.log('After login URL:', page.url());
    
    // Check if 2FA is needed
    const body = await page.locator('body').textContent() || '';
    if (body.includes('two-factor') || body.includes('2FA') || body.includes('verification code')) {
      console.log('2FA REQUIRED - need to handle this');
    }
    
    if (page.url().includes('sessions')) {
      console.log('Successfully logged in to GitHub!');
      
      // Create a Personal Access Token
      console.log('Navigating to create token...');
      await page.goto('https://github.com/settings/tokens/new?scopes=repo,workflow', { timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000));
      
      // Fill token form
      await page.fill('#token_description', 'SONA Platform Deploy Token');
      
      // Check repo scope
      await page.check('input[name="scopes[]"][value="repo"]').catch(() => {});
      
      // Generate token
      await page.locator('button:has-text("Generate token")').first().click().catch(() => {});
      await new Promise(r => setTimeout(r, 5000));
      
      // Get the token
      const tokenEl = page.locator('#new-oauth-token, .token');
      if (await tokenEl.count() > 0) {
        const token = await tokenEl.textContent();
        console.log('TOKEN:', token);
        fs.writeFileSync('/home/z/my-project/github-token.txt', token);
      } else {
        console.log('Token page URL:', page.url());
        const tokenText = await page.locator('body').textContent();
        console.log('Token page text:', tokenText?.substring(0, 500));
      }
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/github-state.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
