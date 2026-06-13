const { chromium } = require('playwright');

const GMAIL = 'helpsona.support@gmail.com';
const PASSWORD = '*R^,6Nc($8H7T*X';
const PROJECT_NAME = 'sona-email-service';
const PROJECT_ID_PREFIX = 'sona-email-service';

(async () => {
  const browser = await chromium.launch({ 
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'] 
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('Step 1: Navigating to Google Cloud Console...');
    await page.goto('https://console.cloud.google.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    
    const url = page.url();
    console.log('Current URL:', url);
    
    // Check if we need to log in
    if (url.includes('accounts.google.com')) {
      console.log('Step 2: Logging in to Google...');
      
      // Enter email
      const emailInput = page.locator('input[type="email"], input[name="identifier"]');
      await emailInput.waitFor({ timeout: 10000 });
      await emailInput.fill(GMAIL);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      
      // Enter password
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      await passwordInput.waitFor({ timeout: 10000 });
      await passwordInput.fill(PASSWORD);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(5000);
      
      const afterLoginUrl = page.url();
      console.log('After login URL:', afterLoginUrl);
      
      // Check for 2FA or other challenges
      if (afterLoginUrl.includes('challenge') || afterLoginUrl.includes('signin')) {
        console.log('WARNING: 2FA or additional verification may be required');
        // Try to proceed anyway
      }
    }
    
    // Take screenshot to see current state
    await page.screenshot({ path: '/home/z/my-project/download/gcloud-state.png' });
    console.log('Screenshot saved to /home/z/my-project/download/gcloud-state.png');
    
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);
    console.log('Current URL:', currentUrl);
    
  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/home/z/my-project/download/gcloud-error.png' }).catch(() => {});
  } finally {
    await browser.close();
  }
})();
