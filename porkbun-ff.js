const { firefox } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await firefox.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log('Loading Porkbun...');
    await page.goto('https://porkbun.com/account/login?captchaProvider=cloudflareCaptcha', { 
      waitUntil: 'domcontentloaded', timeout: 60000 
    });
    await page.waitForTimeout(8000);
    
    // Accept cookies
    await page.evaluate(() => { if(typeof cookieBannerSave==='function') cookieBannerSave(true,true); }).catch(()=>{});
    await page.waitForTimeout(2000);
    
    // Fill form
    await page.fill('#loginUsername', 'helpsona.support@gmail.com');
    await page.fill('#loginPassword', '*R^,6Nc($8H7T*X');
    console.log('Form filled');
    
    // Wait for Turnstile
    await page.waitForTimeout(20000);
    
    // Click login
    await page.click('#accountLoginButton').catch(()=>{});
    await page.waitForTimeout(15000);
    
    let url = page.url();
    console.log('After login:', url);
    
    if(url.includes('login')) {
      // Check error
      const err = await page.evaluate(() => {
        const el = document.querySelector('.alert, [class*="error"]');
        return el ? el.textContent.trim() : 'no error element';
      });
      console.log('Error:', err);
    }
    
    if(!url.includes('login')) {
      console.log('LOGGED IN! Going to DNS...');
      await page.goto('https://porkbun.com/management/dns/sona.support', { timeout: 30000 });
      await page.waitForTimeout(5000);
      
      // Add DKIM TXT
      console.log('Adding records...');
      
      // Click Add Record
      const addBtns = await page.locator('button').all();
      for(const btn of addBtns) {
        const text = await btn.textContent().catch(()=>'');
        if(text.includes('Add Record') || text.includes('Add record')) {
          await btn.click();
          console.log('Clicked Add Record');
          break;
        }
      }
      await page.waitForTimeout(2000);
      
      // List all form elements
      const formInfo = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input, select, textarea');
        return Array.from(inputs).map(i => ({
          tag: i.tagName, type: i.type, name: i.name, id: i.id, 
          placeholder: i.placeholder, visible: i.offsetParent !== null
        })).filter(i => i.visible);
      });
      console.log('Form elements:', JSON.stringify(formInfo, null, 2));
      
      await page.screenshot({ path: '/home/z/my-project/download/porkbun-add-form.png' });
    }
    
  } catch(e) { 
    console.error('Error:', e.message); 
  } finally { 
    if(browser) await browser.close(); 
  }
})();
