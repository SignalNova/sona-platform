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
    
    const afterLoginUrl = page.url();
    console.log('After login URL:', afterLoginUrl);
    
    // Check for 2FA
    const body = await page.locator('body').textContent() || '';
    if (body.includes('two-factor') || page.url().includes('two-factor')) {
      console.log('2FA REQUIRED - trying to handle...');
      
      // Check if there's an email 2FA option
      const email2FABtn = page.locator('button:has-text("email"), a:has-text("email"), button:has-text("Email")').first();
      if (await email2FABtn.count() > 0) {
        console.log('Found email 2FA button, clicking...');
        await email2FABtn.click();
        await new Promise(r => setTimeout(r, 5000));
      }
    }
    
    // Try to navigate to token page
    console.log('Step 2: Creating Personal Access Token...');
    await page.goto('https://github.com/settings/tokens?type=beta', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    const tokenUrl = page.url();
    console.log('Token page URL:', tokenUrl);
    
    // Try to create a fine-grained token
    await page.goto('https://github.com/settings/personal-access-tokens/new', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // Fill token name
    await page.fill('#token_name', 'SONA Deploy').catch(() => {});
    
    // Set expiration
    await page.selectOption('#expiration', '90d').catch(() => {});
    
    // Select repository access - all repos
    await page.locator('input[name="repository_access"][value="all"]').check().catch(() => {});
    
    // Click generate
    await page.locator('button:has-text("Generate token")').first().click().catch(() => {});
    await new Promise(r => setTimeout(r, 5000));
    
    const newUrl = page.url();
    console.log('After token generation URL:', newUrl);
    
    // Get token value
    const pageText = await page.locator('body').textContent() || '';
    if (pageText.includes('github_pat_') || pageText.includes('ghp_')) {
      // Extract token
      const match = pageText.match(/(github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9]+)/);
      if (match) {
        console.log('TOKEN FOUND:', match[1]);
        fs.writeFileSync('/home/z/my-project/github-token.txt', match[1]);
      }
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/github-token-page.png' });
    console.log('Page snippet:', pageText.substring(0, 800));
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
