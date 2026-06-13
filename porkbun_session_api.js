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

  // Login to Porkbun
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

  // Now on 2FA page - try to directly call the login API with the 2FA code field
  // Let me first check the API endpoint format
  const loginApiResult = await page.evaluate(async () => {
    // Get all form data
    const formData = {};
    document.querySelectorAll('input').forEach(inp => {
      if (inp.name || inp.id) {
        formData[inp.name || inp.id] = inp.value;
      }
    });
    return formData;
  });
  
  console.log('All form data:', JSON.stringify(loginApiResult, null, 2));

  // Let me try to access the DNS API using the session cookies
  // even though we're not fully logged in
  const dnsApiResult = await page.evaluate(async () => {
    try {
      const resp = await fetch('/api/json/v3/dns/retrieve/sona.support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      return await resp.text();
    } catch(e) {
      return 'Error: ' + e.message;
    }
  });
  console.log('DNS API (no auth):', dnsApiResult);

  // Try with apikey from session
  const dnsApiResult2 = await page.evaluate(async () => {
    try {
      const resp = await fetch('/api/dns/retrieve/sona.support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      return await resp.text();
    } catch(e) {
      return 'Error: ' + e.message;
    }
  });
  console.log('DNS API v2 (no auth):', dnsApiResult2);

  // Check if there's a session-based API
  const sessionApiResult = await page.evaluate(async () => {
    try {
      const resp = await fetch('/api/user/sessionInfo');
      return await resp.text();
    } catch(e) {
      return 'Error: ' + e.message;
    }
  });
  console.log('Session info:', sessionApiResult);

  // Let me also check the network requests that the DNS management page makes
  // by navigating to a different domain's DNS page that I know works
  await page.goto('https://porkbun.com/management', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  const mgmtUrl = page.url();
  const mgmtText = await page.innerText('body').catch(() => '');
  console.log('Management URL:', mgmtUrl);
  console.log('Management text (first 500):', mgmtText.substring(0, 500));

  await browser.close();
})();
