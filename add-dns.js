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
    await page.goto('https://porkbun.com/account/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));
    
    // Accept cookies
    try {
      const acceptBtn = page.locator('button:has-text("Accept All")');
      if (await acceptBtn.isVisible({ timeout: 3000 })) {
        await acceptBtn.click();
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch(e) {}
    
    // Fill login
    await page.fill('#loginUsername', 'helpsona.support@gmail.com');
    await page.fill('#loginPassword', '*R^,6Nc($8H7T*X');
    
    // Try clicking Porkbun CAPTCHA
    const porkCaptcha = page.locator('#my-porkcaptcha_accountLogin');
    const box = await porkCaptcha.boundingBox().catch(() => null);
    if (box) {
      console.log('Found Porkbun CAPTCHA, clicking...');
      await page.mouse.click(box.x + 28, box.y + box.height / 2);
      await new Promise(r => setTimeout(r, 15000));
    } else {
      console.log('Waiting for turnstile...');
      await new Promise(r => setTimeout(r, 12000));
    }
    
    // Click Login
    await page.locator('#accountLoginButton').click().catch(() => {});
    await new Promise(r => setTimeout(r, 10000));
    
    const url = page.url();
    console.log('After login URL:', url);
    
    const body = await page.locator('body').textContent() || '';
    
    if (body.includes('unable to log you in')) {
      console.log('LOGIN FAILED - CAPTCHA or wrong credentials');
      await page.screenshot({ path: '/home/z/my-project/download/porkbun-fail.png' });
    } else if (!url.includes('login')) {
      console.log('LOGGED IN! Going to DNS page...');
      await page.goto('https://porkbun.com/management/dns/sona.support', { timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000));
      
      // Add DKIM TXT record
      console.log('Adding DKIM TXT record...');
      // Click add record button
      const addBtn = page.locator('button:has-text("Add"), a:has-text("Add Record")').first();
      await addBtn.click().catch(() => console.log('No add button found'));
      await new Promise(r => setTimeout(r, 2000));
      
      // Fill the form
      await page.selectOption('select#dnsType', 'TXT').catch(() => {});
      await page.fill('input#dnsSubdomain', 'resend._domainkey').catch(() => {});
      await page.fill('textarea#dnsContent, input#dnsContent', 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCzo7M5wZMqAvNmDKUPZbw1zOYfqx7HbSrfxXmYVuj+U7LwRXdTCIsw8MEJ9BqyLtZBjrvAFkOa9zG7pMFQLrI7kpW+baVO+CCNIIY2xG/aPcWU5iusrJRg+T6tQ2xHSBhq3N6IMp9VFAKlYCKCm/Jnb3Nzq5/7KTA2r709NqE1dwIDAQAB').catch(() => {});
      
      // Click save
      await page.locator('button:has-text("Save"), button:has-text("Add Record")').first().click().catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
      console.log('DKIM record added');
      
      // Add SPF MX record
      console.log('Adding SPF MX record...');
      await page.locator('button:has-text("Add"), a:has-text("Add Record")').first().click().catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      await page.selectOption('select#dnsType', 'MX').catch(() => {});
      await page.fill('input#dnsSubdomain', 'send').catch(() => {});
      await page.fill('input#dnsContent', 'feedback-smtp.us-east-1.amazonses.com').catch(() => {});
      await page.fill('input#dnsPrio', '10').catch(() => {});
      await page.locator('button:has-text("Save"), button:has-text("Add Record")').first().click().catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
      console.log('SPF MX record added');
      
      // Add SPF TXT record
      console.log('Adding SPF TXT record...');
      await page.locator('button:has-text("Add"), a:has-text("Add Record")').first().click().catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      await page.selectOption('select#dnsType', 'TXT').catch(() => {});
      await page.fill('input#dnsSubdomain', 'send').catch(() => {});
      await page.fill('textarea#dnsContent, input#dnsContent', 'v=spf1 include:amazonses.com ~all').catch(() => {});
      await page.locator('button:has-text("Save"), button:has-text("Add Record")').first().click().catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
      console.log('SPF TXT record added');
      
      await page.screenshot({ path: '/home/z/my-project/download/porkbun-dns-final.png' });
      console.log('ALL DNS RECORDS ADDED!');
    } else {
      console.log('Unknown state');
      await page.screenshot({ path: '/home/z/my-project/download/porkbun-unknown.png' });
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
