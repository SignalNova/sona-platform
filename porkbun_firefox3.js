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

  await page.goto('https://porkbun.com/account/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Accept cookies
  try {
    const acceptBtn = page.locator('button:has-text("Accept All")');
    if (await acceptBtn.isVisible({ timeout: 3000 })) {
      await acceptBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch(e) {}

  // Fill login
  await page.fill('#loginUsername', 'helpsona.support@gmail.com');
  await page.fill('#loginPassword', '*R^,6Nc($8H7T*X');
  console.log('Filled credentials');

  // Click on the "I'm not a robot" checkbox area
  // The captcha element is at x:692.5, y:398, width:535, height:66
  // The checkbox is typically at the left side
  const porkCaptcha = page.locator('#my-porkcaptcha_accountLogin');
  const box = await porkCaptcha.boundingBox();
  console.log('Captcha box:', box);
  
  if (box) {
    // Click on the checkbox area (left side, centered vertically)
    await page.mouse.click(box.x + 28, box.y + box.height / 2);
    console.log('Clicked captcha checkbox');
    await page.waitForTimeout(15000);
    
    // Check if captcha was solved
    const porkToken = await page.locator('#porkcaptcha-token_accountLogin').inputValue().catch(() => '');
    console.log('Pork captcha token after click:', porkToken ? 'has value (len=' + porkToken.length + ')' : 'empty');
    
    // Also check cf-turnstile-response
    const cfToken = await page.locator('input[name="cf-turnstile-response"]').first().inputValue().catch(() => '');
    console.log('CF turnstile token:', cfToken ? 'has value (len=' + cfToken.length + ')' : 'empty');
  }

  await page.screenshot({ path: '/tmp/porkbun_captcha_click.png' });
  
  // If still not solved, try a few more clicks in different positions
  if (box) {
    // Try clicking in a different position
    await page.mouse.click(box.x + 20, box.y + 33);
    await page.waitForTimeout(10000);
    
    const porkToken2 = await page.locator('#porkcaptcha-token_accountLogin').inputValue().catch(() => '');
    console.log('Pork captcha token after 2nd click:', porkToken2 ? 'has value (len=' + porkToken2.length + ')' : 'empty');
  }

  // Let's also look at what's inside the captcha div more carefully
  const captchaHTML = await page.locator('#my-porkcaptcha_accountLogin').innerHTML().catch(() => '');
  console.log('Captcha HTML (first 1000):', captchaHTML.substring(0, 1000));

  await page.screenshot({ path: '/tmp/porkbun_captcha_click2.png' });
  
  await browser.close();
})();
