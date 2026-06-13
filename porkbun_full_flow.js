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

  // ===== LOGIN TO PORKBUN =====
  console.log('=== LOGIN TO PORKBUN ===');
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

  // Click CAPTCHA checkbox
  const porkCaptcha = page.locator('#my-porkcaptcha_accountLogin');
  const box = await porkCaptcha.boundingBox();
  if (box) {
    await page.mouse.click(box.x + 28, box.y + box.height / 2);
    await page.waitForTimeout(15000);
  }

  // Click Login
  const loginBtn = page.locator('button:has-text("Login")').first();
  await loginBtn.click();
  await page.waitForTimeout(8000);
  
  console.log('URL after login attempt:', page.url());
  
  // Now we should be on the 2FA page
  // Try to access Gmail in the same browser context to get the code
  console.log('\n=== ACCESSING GMAIL FOR CODE ===');
  const gmailPage = await context.newPage();
  await gmailPage.goto('https://mail.google.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await gmailPage.waitForTimeout(5000);
  
  const gmailUrl = gmailPage.url();
  console.log('Gmail URL:', gmailUrl);
  
  // Since Google blocks automated login, try another approach
  // Let me try to use the Google AI Studio or another Google service that might be accessible
  
  // Actually, let me try a different approach altogether
  // Let me check if we can find the code via the Gmail basic HTML view
  if (gmailUrl.includes('accounts.google.com')) {
    console.log('Gmail login page detected');
    
    // Try basic HTML Gmail login
    await gmailPage.goto('https://mail.google.com/mail/u/0/h/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await gmailPage.waitForTimeout(3000);
    console.log('Gmail basic HTML URL:', gmailPage.url());
    
    const inputs = await gmailPage.locator('input').all();
    for (const inp of inputs) {
      const type = await inp.getAttribute('type').catch(() => '');
      const name = await inp.getAttribute('name').catch(() => '');
      const id = await inp.getAttribute('id').catch(() => '');
      console.log('Gmail input:', { type, name, id });
    }
  }

  await gmailPage.close();
  
  // Let me try yet another approach - use the Porkbun session API
  // Check the page for the 2FA input
  console.log('\n=== CHECKING 2FA STATE ===');
  const twoFaInput = page.locator('#twoFactorLoginCodeEmailNoCookie');
  if (await twoFaInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('2FA input is visible - code needed');
    // The code was sent to helpsona.support@gmail.com
    // We need to access this email
  }

  // Let me try to read the email using the Gmail feed API
  console.log('\n=== TRYING GMAIL FEED ===');
  const feedPage = await context.newPage();
  await feedPage.goto('https://mail.google.com/mail/feed/atom', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await feedPage.waitForTimeout(3000);
  const feedUrl = feedPage.url();
  console.log('Gmail feed URL:', feedUrl);
  const feedContent = await feedPage.innerText('body').catch(() => '');
  console.log('Feed content (first 500):', feedContent.substring(0, 500));
  await feedPage.close();

  await browser.close();
})();
