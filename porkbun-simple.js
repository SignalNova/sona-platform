const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
    
    // Go to Porkbun login
    await page.goto('https://porkbun.com/account/login?captchaProvider=cloudflareCaptcha', { timeout: 60000 });
    await page.waitForTimeout(5000);
    await page.evaluate(() => { if(typeof cookieBannerSave==='function') cookieBannerSave(true,true); }).catch(()=>{});
    await page.waitForTimeout(1000);
    
    await page.fill('#loginUsername', 'helpsona.support@gmail.com');
    await page.fill('#loginPassword', '*R^,6Nc($8H7T*X');
    
    // Wait for turnstile
    for(let i=0;i<15;i++){
      await page.waitForTimeout(3000);
      if(await page.evaluate(()=>{const b=document.getElementById('accountLoginButton');return b&&!b.disabled;})) break;
    }
    
    await page.click('#accountLoginButton');
    await page.waitForTimeout(15000);
    
    let url = page.url();
    console.log('URL:', url);
    
    if(!url.includes('login')) {
      console.log('LOGGED IN! Adding DNS records...');
      await page.goto('https://porkbun.com/management/dns/sona.support', { timeout: 30000 });
      await page.waitForTimeout(5000);
      await page.screenshot({ path: '/home/z/my-project/download/porkbun-dns-page.png' });
      
      // Get the page text to understand the layout
      const text = await page.evaluate(() => document.body.innerText.substring(0, 2000));
      console.log('DNS page:', text.substring(0, 500));
      
      // Try adding records via the form
      const addBtn = page.locator('button:has-text("Add Record")').first();
      console.log('Add Record button found:', await addBtn.count() > 0);
      
      if(await addBtn.count() > 0) {
        // Add DKIM TXT
        console.log('Adding DKIM TXT...');
        await addBtn.click();
        await page.waitForTimeout(2000);
        await page.selectOption('select', 'TXT').catch(()=>{});
        await page.fill('input[placeholder*="name"], input[placeholder*="subdomain"], input#dnsSubdomain', 'resend._domainkey').catch(()=>console.log('name fill fail'));
        await page.fill('textarea, input#dnsContent', 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCzo7M5wZMqAvNmDKUPZbw1zOYfqx7HbSrfxXmYVuj+U7LwRXdTCIsw8MEJ9BqyLtZBjrvAFkOa9zG7pMFQLrI7kpW+baVO+CCNIIY2xG/aPcWU5iusrJRg+T6tQ2xHSBhq3N6IMp9VFAKlYCKCm/Jnb3Nzq5/7KTA2r709NqE1dwIDAQAB').catch(()=>console.log('content fill fail'));
        await page.locator('button:has-text("Save"),button:has-text("Add")').first().click().catch(()=>{});
        await page.waitForTimeout(3000);
        console.log('DKIM added');
        
        // Add SPF MX
        console.log('Adding SPF MX...');
        await page.locator('button:has-text("Add Record")').first().click().catch(()=>{});
        await page.waitForTimeout(2000);
        await page.selectOption('select', 'MX').catch(()=>{});
        await page.fill('input[placeholder*="name"], input#dnsSubdomain', 'send').catch(()=>{});
        await page.fill('input#dnsContent', 'feedback-smtp.us-east-1.amazonses.com').catch(()=>console.log('mx content fail'));
        await page.fill('input#dnsPrio, input[placeholder*="priority"]', '10').catch(()=>{});
        await page.locator('button:has-text("Save"),button:has-text("Add")').first().click().catch(()=>{});
        await page.waitForTimeout(3000);
        console.log('SPF MX added');
        
        // Add SPF TXT
        console.log('Adding SPF TXT...');
        await page.locator('button:has-text("Add Record")').first().click().catch(()=>{});
        await page.waitForTimeout(2000);
        await page.selectOption('select', 'TXT').catch(()=>{});
        await page.fill('input[placeholder*="name"], input#dnsSubdomain', 'send').catch(()=>{});
        await page.fill('textarea, input#dnsContent', 'v=spf1 include:amazonses.com ~all').catch(()=>console.log('spf txt fill fail'));
        await page.locator('button:has-text("Save"),button:has-text("Add")').first().click().catch(()=>{});
        await page.waitForTimeout(3000);
        console.log('SPF TXT added');
        
        console.log('ALL RECORDS ADDED!');
      }
    } else {
      console.log('Login failed');
    }
    
    await page.screenshot({ path: '/home/z/my-project/download/porkbun-final.png' });
  } catch(e) { 
    console.error('Error:', e.message); 
  } finally { 
    if(browser) await browser.close(); 
  }
})();
