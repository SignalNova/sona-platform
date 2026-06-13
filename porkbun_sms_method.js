const { firefox } = require('playwright');

(async () => {
  const browser = await firefox.launch({ 
    headless: true
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0',
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();

  // Login flow
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

  // Click CAPTCHA checkbox
  const porkCaptcha = page.locator('#my-porkcaptcha_accountLogin');
  const box = await porkCaptcha.boundingBox();
  if (box) {
    await page.mouse.click(box.x + 28, box.y + box.height / 2);
    await new Promise(r => setTimeout(r, 15000));
  }

  // Click Login
  await page.locator('button:has-text("Login")').first().click();
  await new Promise(r => setTimeout(r, 8000));

  // Now on 2FA page - look for the SMS option
  // From earlier analysis, there was "Get a code sent via SMS to your account phone number."
  // and "send SMS code" button
  
  // Let me look at the page more carefully
  const allButtons = await page.locator('button').all();
  for (const btn of allButtons) {
    const text = await btn.innerText().catch(() => '');
    const visible = await btn.isVisible().catch(() => false);
    const id = await btn.getAttribute('id').catch(() => '');
    if (visible && text) {
      console.log(`Button: id=${id} text="${text.trim()}"`);
    }
  }

  // Try to find and click "send SMS code" button
  try {
    const smsBtn = page.locator('button:has-text("send SMS code"), #sendSmsCode').first();
    if (await smsBtn.isVisible({ timeout: 3000 })) {
      console.log('Found SMS button!');
      await smsBtn.click();
      console.log('Clicked SMS button');
      await new Promise(r => setTimeout(r, 5000));
      
      // Check the result
      const bodyText = await page.innerText('body').catch(() => '');
      console.log('After SMS click (first 800):', bodyText.substring(0, 800));
    } else {
      console.log('SMS button not visible');
    }
  } catch(e) {
    console.log('SMS button error:', e.message.substring(0, 100));
  }

  // Also try "use another method" links
  try {
    const anotherMethodLinks = await page.locator('a:has-text("use another method"), button:has-text("use another method")').all();
    console.log('Found', anotherMethodLinks.length, '"use another method" links');
    
    for (let i = 0; i < anotherMethodLinks.length; i++) {
      const visible = await anotherMethodLinks[i].isVisible().catch(() => false);
      console.log(`Link ${i}: visible=${visible}`);
      if (visible) {
        await anotherMethodLinks[i].click();
        console.log(`Clicked "use another method" link ${i}`);
        await new Promise(r => setTimeout(r, 3000));
        
        // Check what's showing now
        const currentText = await page.innerText('body').catch(() => '');
        console.log('After clicking another method (first 800):', currentText.substring(0, 800));
        break;
      }
    }
  } catch(e) {
    console.log('Another method error:', e.message.substring(0, 100));
  }

  await page.screenshot({ path: '/tmp/porkbun_2fa_sms.png' });
  await browser.close();
})();
