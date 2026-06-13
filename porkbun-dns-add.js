const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ 
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled', 
        '--no-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US'
    });
    const page = await context.newPage();
    
    // Anti-detection
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      window.chrome = { runtime: {} };
    });
    
    // Step 1: Login to Porkbun with Cloudflare Turnstile
    console.log('Step 1: Loading Porkbun login...');
    await page.goto('https://porkbun.com/account/login?captchaProvider=cloudflareCaptcha', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });
    await new Promise(r => setTimeout(r, 5000));
    
    // Dismiss cookie banner via JS
    await page.evaluate(() => { 
      if (typeof cookieBannerSave === 'function') cookieBannerSave(true, true); 
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));
    
    // Type slowly like a human
    console.log('Filling login form...');
    const emailInput = page.locator('#loginUsername');
    const passInput = page.locator('#loginPassword');
    
    await emailInput.click();
    await new Promise(r => setTimeout(r, 300));
    await emailInput.type('helpsona.support@gmail.com', { delay: 50 });
    await new Promise(r => setTimeout(r, 500));
    
    await passInput.click();
    await new Promise(r => setTimeout(r, 300));
    await passInput.type('*R^,6Nc($8H7T*X', { delay: 50 });
    await new Promise(r => setTimeout(r, 1000));
    
    // Wait for Turnstile to solve
    console.log('Waiting for Turnstile to solve...');
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const enabled = await page.evaluate(() => {
        const btn = document.getElementById('accountLoginButton');
        return btn && !btn.disabled;
      });
      if (enabled) {
        console.log(`Turnstile solved after ${(i+1)*3}s`);
        break;
      }
      if (i === 29) console.log('Turnstile timeout, trying anyway...');
    }
    
    // Click login with human-like behavior
    const loginBtn = page.locator('#accountLoginButton');
    await loginBtn.scrollIntoViewIfNeeded();
    await new Promise(r => setTimeout(r, 500));
    
    // Move mouse to button and click
    const box = await loginBtn.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width/2, box.y + box.height/2, { steps: 10 });
      await new Promise(r => setTimeout(r, 200));
      await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
    } else {
      await loginBtn.click();
    }
    
    console.log('Login clicked, waiting...');
    await new Promise(r => setTimeout(r, 15000));
    
    let currentUrl = page.url();
    console.log('After login URL:', currentUrl);
    
    // Check for 2FA
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    
    if (bodyText.includes('unable to log you in')) {
      console.log('LOGIN FAILED - CAPTCHA rejected. Trying again with more delay...');
      
      // Try one more time - refresh and retry
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000));
      
      await page.evaluate(() => { 
        if (typeof cookieBannerSave === 'function') cookieBannerSave(true, true); 
      }).catch(() => {});
      
      await emailInput.type('helpsona.support@gmail.com', { delay: 80 });
      await passInput.type('*R^,6Nc($8H7T*X', { delay: 80 });
      
      // Wait much longer for Turnstile
      await new Promise(r => setTimeout(r, 30000));
      
      await loginBtn.click();
      await new Promise(r => setTimeout(r, 15000));
      
      currentUrl = page.url();
      console.log('Second attempt URL:', currentUrl);
    }
    
    if (currentUrl.includes('login')) {
      console.log('Still on login page. Checking page...');
      const retryText = await page.evaluate(() => document.body.innerText.substring(0, 500));
      console.log(retryText);
      
      // Try 2FA if visible
      const twoFAInput = page.locator('#twoFactorLoginCodeEmail');
      if (await twoFAInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('2FA email code input visible!');
      }
    }
    
    if (!currentUrl.includes('login') || currentUrl.includes('account') || currentUrl.includes('management')) {
      console.log('SUCCESS! Logged in. Navigating to DNS...');
      
      // Navigate to DNS management
      await page.goto('https://porkbun.com/management/dns/sona.support', { timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000));
      
      // Take screenshot of current DNS
      await page.screenshot({ path: '/home/z/my-project/download/porkbun-dns-before.png' });
      
      // Function to add a DNS record
      async function addDnsRecord(type, name, content, priority) {
        console.log(`Adding ${type} record: ${name} -> ${content.substring(0, 50)}...`);
        
        // Click Add Record button
        const addBtn = page.locator('button:has-text("Add Record"), button:has-text("Add"), a:has-text("Add Record")').first();
        await addBtn.click().catch(() => console.log('Add button click failed'));
        await new Promise(r => setTimeout(r, 2000));
        
        // Select type
        const typeSelect = page.locator('select#dnsType, select[name="type"]').first();
        if (await typeSelect.count() > 0) {
          await typeSelect.selectOption(type);
          console.log(`Type set to ${type}`);
        }
        await new Promise(r => setTimeout(r, 500));
        
        // Fill subdomain
        const nameInput = page.locator('input#dnsSubdomain, input[name="subdomain"], input[placeholder*="name"]').first();
        if (await nameInput.count() > 0) {
          await nameInput.click();
          await nameInput.fill(name);
          console.log(`Name filled: ${name}`);
        }
        await new Promise(r => setTimeout(r, 500));
        
        // Fill content
        const contentInput = page.locator('textarea#dnsContent, input#dnsContent, textarea[name="content"]').first();
        if (await contentInput.count() > 0) {
          await contentInput.click();
          await contentInput.fill(content);
          console.log(`Content filled`);
        }
        await new Promise(r => setTimeout(r, 500));
        
        // Fill priority for MX
        if (priority) {
          const prioInput = page.locator('input#dnsPrio, input[name="priority"]').first();
          if (await prioInput.count() > 0) {
            await prioInput.fill(priority.toString());
            console.log(`Priority set to ${priority}`);
          }
        }
        
        // Click Save/Add button
        const saveBtn = page.locator('button:has-text("Save"), button:has-text("Add Record"), button:has-text("Submit")').first();
        if (await saveBtn.count() > 0) {
          await saveBtn.click();
          console.log(`Record saved!`);
        } else {
          // Try submitting the form
          await page.evaluate(() => {
            const form = document.querySelector('form');
            if (form) form.submit();
          });
        }
        
        await new Promise(r => setTimeout(r, 3000));
      }
      
      // Add the 3 DNS records
      await addDnsRecord('TXT', 'resend._domainkey', 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCzo7M5wZMqAvNmDKUPZbw1zOYfqx7HbSrfxXmYVuj+U7LwRXdTCIsw8MEJ9BqyLtZBjrvAFkOa9zG7pMFQLrI7kpW+baVO+CCNIIY2xG/aPcWU5iusrJRg+T6tQ2xHSBhq3N6IMp9VFAKlYCKCm/Jnb3Nzq5/7KTA2r709NqE1dwIDAQAB');
      
      await addDnsRecord('MX', 'send', 'feedback-smtp.us-east-1.amazonses.com', 10);
      
      await addDnsRecord('TXT', 'send', 'v=spf1 include:amazonses.com ~all');
      
      console.log('ALL 3 DNS RECORDS ADDED!');
      
      await page.screenshot({ path: '/home/z/my-project/download/porkbun-dns-after.png' });
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
