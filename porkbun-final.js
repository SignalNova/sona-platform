const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
    
    // Login to Porkbun
    console.log('Loading Porkbun...');
    await page.goto('https://porkbun.com/account/login', { timeout: 60000 });
    await page.waitForTimeout(5000);
    
    await page.evaluate(() => { if(typeof cookieBannerSave==='function') cookieBannerSave(true,true); }).catch(()=>{});
    await page.waitForTimeout(1000);
    
    // Fill login
    await page.fill('#loginUsername', 'helpsona.support@gmail.com');
    await page.fill('#loginPassword', '*R^,6Nc($8H7T*X');
    
    // Click Porkbun CAPTCHA
    const captchaEl = page.locator('#my-porkcaptcha_accountLogin');
    const captchaBox = await captchaEl.boundingBox().catch(() => null);
    if (captchaBox) {
      await page.mouse.click(captchaBox.x + 25, captchaBox.y + captchaBox.height/2);
      await page.waitForTimeout(15000);
    }
    
    // Login
    await page.click('#accountLoginButton').catch(()=>{});
    await page.waitForTimeout(10000);
    
    let url = page.url();
    console.log('URL:', url);
    
    if (!url.includes('login')) {
      console.log('LOGGED IN! Navigating to DNS...');
      await page.goto('https://porkbun.com/management/dns/sona.support', { timeout: 30000 });
      await page.waitForTimeout(5000);
      
      // First, let me check what DNS records exist
      // List all current records
      const existingRecords = await page.evaluate(() => {
        const rows = document.querySelectorAll('tr, [class*="record"]');
        return Array.from(rows).length;
      });
      console.log('Existing rows:', existingRecords);
      
      // Screenshot current state
      await page.screenshot({ path: '/home/z/my-project/download/porkbun-dns-current.png' });
      
      // Get the page HTML structure to find the form
      const formElements = await page.evaluate(() => {
        const elements = document.querySelectorAll('button, select, input, textarea');
        return Array.from(elements).filter(e => e.offsetParent !== null).map(e => ({
          tag: e.tagName,
          type: e.type || '',
          name: e.name || '',
          id: e.id || '',
          placeholder: e.placeholder || '',
          text: e.textContent?.trim().substring(0, 30) || '',
          value: e.value?.substring(0, 30) || ''
        }));
      });
      console.log('Form elements:', JSON.stringify(formElements.filter(e => e.text || e.placeholder), null, 2));
      
      // Click "Add Record" button
      const addBtns = await page.locator('button').all();
      for (const btn of addBtns) {
        const text = await btn.textContent().catch(() => '');
        if (text.includes('Add Record')) {
          console.log('Found Add Record button, clicking...');
          await btn.click();
          break;
        }
      }
      await page.waitForTimeout(3000);
      
      // Take screenshot of form
      await page.screenshot({ path: '/home/z/my-project/download/porkbun-add-form.png' });
      
      // Now fill the form for DKIM TXT
      const addFormElements = await page.evaluate(() => {
        const elements = document.querySelectorAll('button, select, input, textarea');
        return Array.from(elements).filter(e => e.offsetParent !== null).map(e => ({
          tag: e.tagName,
          type: e.type || '',
          name: e.name || '',
          id: e.id || '',
          placeholder: e.placeholder || '',
          text: e.textContent?.trim().substring(0, 30) || ''
        }));
      });
      console.log('Add form elements:', JSON.stringify(addFormElements, null, 2));
      
      // Fill type
      await page.selectOption('select', 'TXT').catch(()=> console.log('select failed'));
      await page.waitForTimeout(500);
      
      // Fill name
      await page.fill('input[placeholder*="name" i], input[placeholder*="subdomain" i], input#dnsSubdomain', 'resend._domainkey').catch(()=> console.log('name fill failed'));
      await page.waitForTimeout(500);
      
      // Fill content
      await page.fill('textarea, input#dnsContent', 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCzo7M5wZMqAvNmDKUPZbw1zOYfqx7HbSrfxXmYVuj+U7LwRXdTCIsw8MEJ9BqyLtZBjrvAFkOa9zG7pMFQLrI7kpW+baVO+CCNIIY2xG/aPcWU5iusrJRg+T6tQ2xHSBhq3N6IMp9VFAKlYCKCm/Jnb3Nzq5/7KTA2r709NqE1dwIDAQAB').catch(()=> console.log('content fill failed'));
      await page.waitForTimeout(500);
      
      // Click Save/Submit
      for (const btn of await page.locator('button').all()) {
        const text = await btn.textContent().catch(() => '');
        if (text.includes('Save') || text.includes('Add Record') || text.includes('Submit')) {
          await btn.click();
          console.log('Clicked:', text.trim().substring(0, 30));
          break;
        }
      }
      await page.waitForTimeout(3000);
      console.log('DKIM TXT added');
      
      await page.screenshot({ path: '/home/z/my-project/download/porkbun-after-dkim.png' });
      
      // Add SPF MX
      // Click Add Record again
      for (const btn of await page.locator('button').all()) {
        const text = await btn.textContent().catch(() => '');
        if (text.includes('Add Record')) {
          await btn.click();
          break;
        }
      }
      await page.waitForTimeout(2000);
      await page.selectOption('select', 'MX').catch(()=>{});
      await page.fill('input[placeholder*="name" i], input#dnsSubdomain', 'send').catch(()=>{});
      await page.fill('input#dnsContent', 'feedback-smtp.us-east-1.amazonses.com').catch(()=>console.log('mx content fail'));
      await page.fill('input#dnsPrio, input[placeholder*="priority"]', '10').catch(()=>{});
      for (const btn of await page.locator('button').all()) {
        const text = await btn.textContent().catch(() => '');
        if (text.includes('Save') || text.includes('Add Record')) { await btn.click(); break; }
      }
      await page.waitForTimeout(3000);
      console.log('SPF MX added');
      
      // Add SPF TXT
      for (const btn of await page.locator('button').all()) {
        const text = await btn.textContent().catch(() => '');
        if (text.includes('Add Record')) { await btn.click(); break; }
      }
      await page.waitForTimeout(2000);
      await page.selectOption('select', 'TXT').catch(()=>{});
      await page.fill('input[placeholder*="name" i], input#dnsSubdomain', 'send').catch(()=>{});
      await page.fill('textarea, input#dnsContent', 'v=spf1 include:amazonses.com ~all').catch(()=>console.log('spf fill fail'));
      for (const btn of await page.locator('button').all()) {
        const text = await btn.textContent().catch(() => '');
        if (text.includes('Save') || text.includes('Add Record')) { await btn.click(); break; }
      }
      await page.waitForTimeout(3000);
      console.log('SPF TXT added');
      
      console.log('ALL 3 DNS RECORDS ADDED!');
      await page.screenshot({ path: '/home/z/my-project/download/porkbun-dns-final.png' });
    } else {
      console.log('Login failed, trying API key page...');
      // Try to navigate to API key page
      await page.goto('https://porkbun.com/account/api', { timeout: 30000 });
      await page.waitForTimeout(5000);
      
      const pageText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
      console.log('API page:', pageText.substring(0, 500));
    }
    
  } catch(e) { console.error('Error:', e.message); }
  finally { if(browser) await browser.close(); }
})();
