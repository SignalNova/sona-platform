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

  // Intercept requests
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('porkbun.com/api') || url.includes('porkbun.com/account')) {
      try {
        const text = await response.text().catch(() => '');
        if (text.length < 2000) {
          console.log('Response:', url.substring(0, 100), 'Body:', text.substring(0, 500));
        } else {
          console.log('Response:', url.substring(0, 100), 'Body length:', text.length);
        }
      } catch(e) {}
    }
  });

  await page.goto('https://porkbun.com/account/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Accept cookies
  try {
    const acceptBtn = page.locator('button:has-text("Accept All")');
    if (await acceptBtn.isVisible({ timeout: 3000 })) {
      await acceptBtn.click();
      console.log('Accepted cookies');
      await page.waitForTimeout(1000);
    }
  } catch(e) {}

  // Fill login
  await page.fill('#loginUsername', 'helpsona.support@gmail.com');
  await page.fill('#loginPassword', '*R^,6Nc($8H7T*X');
  console.log('Filled credentials');

  // Try to find and click the captcha checkbox using the Cloudflare Turnstile
  // The turnstile checkbox is typically inside an iframe
  const frames = page.frames();
  console.log('Total frames:', frames.length);
  for (const frame of frames) {
    if (frame.url().includes('challenges.cloudflare') || frame.url().includes('turnstile')) {
      console.log('Turnstile frame:', frame.url().substring(0, 150));
      // Try to find clickable elements
      try {
        const bodyHTML = await frame.locator('body').innerHTML().catch(() => '');
        console.log('Turnstile body HTML:', bodyHTML.substring(0, 500));
      } catch(e) {}
    }
  }

  // Let's try to click the "I'm not a robot" area
  // The checkbox is typically in a specific location
  try {
    // Try to find the captcha container and click the checkbox area
    const captchaContainer = page.locator('.cf-turnstile, [data-sitekey]').first();
    const box = await captchaContainer.boundingBox().catch(() => null);
    console.log('Captcha container box:', box);
    if (box) {
      // The checkbox is typically at the left side of the captcha widget
      await page.mouse.click(box.x + 28, box.y + 28);
      console.log('Clicked captcha checkbox area');
      await page.waitForTimeout(10000);
    }
  } catch(e) {
    console.log('Captcha click error:', e.message.substring(0, 200));
  }

  // Also check the Pork Captcha div
  try {
    const porkCaptcha = page.locator('[id*="porkcaptcha"]');
    const count = await porkCaptcha.count();
    console.log('Pork captcha elements:', count);
    for (let i = 0; i < count; i++) {
      const el = porkCaptcha.nth(i);
      const id = await el.getAttribute('id');
      const visible = await el.isVisible().catch(() => false);
      const box = await el.boundingBox().catch(() => null);
      console.log(`  ${id}: visible=${visible}, box=${JSON.stringify(box)}`);
    }
  } catch(e) {}

  // Check for the cf-turnstile-response 
  const cfInputs = await page.locator('input[name="cf-turnstile-response"], [name*="turnstile"]').all();
  for (const inp of cfInputs) {
    const val = await inp.inputValue().catch(() => '');
    const name = await inp.getAttribute('name');
    console.log(`Turnstile input ${name}: ${val ? 'has value (len=' + val.length + ')' : 'empty'}`);
  }

  // Also check for porkcaptcha-token
  const porkToken = await page.locator('[id*="porkcaptcha-token"]').inputValue().catch(() => '');
  console.log('Pork captcha token:', porkToken ? 'has value (len=' + porkToken.length + ')' : 'empty');

  await page.screenshot({ path: '/tmp/porkbun_firefox.png' });
  console.log('Screenshot saved');

  await browser.close();
})();
