const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    
    // Login to Render
    console.log('Logging into Render...');
    await page.goto('https://dashboard.render.com/login', { waitUntil: 'networkidle', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    
    await page.locator('input[type="email"]').first().fill('helpsona.support@gmail.com');
    await page.locator('input[type="password"]').first().fill('*R^,6Nc($8H7T*X');
    await page.locator('button:has-text("Log In"), button[type="submit"]').first().click();
    await new Promise(r => setTimeout(r, 10000));
    
    // Navigate to the shell page
    console.log('Looking for Shell feature...');
    await page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg/shell', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    const url = page.url();
    console.log('Shell page URL:', url);
    
    const pageText = await page.locator('body').textContent() || '';
    const hasShell = pageText.includes('Shell') || pageText.includes('terminal') || pageText.includes('Terminal');
    console.log('Has shell feature:', hasShell);
    console.log('Page snippet:', pageText.substring(0, 200));
    
    // If no shell, try to find it in the sidebar
    if (!hasShell) {
      // Check all sidebar links
      const links = await page.evaluate(() => {
        const navLinks = document.querySelectorAll('a, [role="tab"]');
        return Array.from(navLinks).filter(l => l.offsetParent !== null).map(l => ({
          text: l.textContent?.trim().substring(0, 30),
          href: l.getAttribute('href')?.substring(0, 50)
        }));
      });
      console.log('Nav links:', JSON.stringify(links.filter(l => l.text)));
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/render-shell.png' });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
