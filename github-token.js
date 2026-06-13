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
    console.log('Step 1: Logging into GitHub...');
    await page.goto('https://github.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    
    await page.fill('#login_field', 'helpsona.support@gmail.com');
    await page.fill('#password', '*R^,6Nc($8H7T*X');
    await page.locator('input[type="submit"]').first().click();
    await new Promise(r => setTimeout(r, 10000));
    
    let currentUrl = page.url();
    console.log('After login URL:', currentUrl);
    
    // Check for 2FA
    const bodyText = await page.locator('body').textContent() || '';
    
    if (currentUrl.includes('two-factor') || bodyText.includes('Two-factor authentication')) {
      console.log('2FA REQUIRED');
      
      // Try SMS or email recovery
      // Look for fallback options
      const links = await page.evaluate(() => {
        const allLinks = document.querySelectorAll('a');
        return Array.from(allLinks).map(a => ({ text: a.textContent?.trim(), href: a.href })).filter(l => l.text);
      });
      console.log('Links on 2FA page:', JSON.stringify(links.slice(0, 20)));
    }
    
    // Check if we're actually logged in by checking the page
    if (currentUrl === 'https://github.com/' || currentUrl.includes('github.com/dashboard')) {
      console.log('Logged in successfully!');
    }
    
    // Now try to create a classic token
    console.log('Step 2: Creating classic token...');
    await page.goto('https://github.com/settings/tokens/new', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    currentUrl = page.url();
    console.log('Token page URL:', currentUrl);
    
    if (currentUrl.includes('login')) {
      console.log('Not logged in - session expired or 2FA required');
    } else {
      // Fill token details
      await page.fill('#token_description', 'SONA Platform Deploy').catch(() => {});
      
      // Check repo scope
      await page.check('input[name="scopes[]"][value="repo"]').catch(() => {});
      await page.check('input[name="scopes[]"][value="workflow"]').catch(() => {});
      
      // Generate
      await page.locator('button:has-text("Generate token")').first().click().catch(() => {});
      await new Promise(r => setTimeout(r, 5000));
      
      // Get token
      const newBody = await page.locator('body').textContent() || '';
      const tokenMatch = newBody.match(/ghp_[A-Za-z0-9]{36,}/);
      if (tokenMatch) {
        console.log('TOKEN:', tokenMatch[0]);
        fs.writeFileSync('/home/z/my-project/github-token.txt', tokenMatch[0]);
      } else {
        console.log('Could not find token. Page snippet:', newBody.substring(0, 500));
      }
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/github-token-state.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
