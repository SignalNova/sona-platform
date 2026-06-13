const { firefox } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await firefox.launch({ 
    headless: true
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0',
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();

  // ===== STEP 1: LOGIN =====
  console.log('=== STEP 1: LOGIN ===');
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

  // Click CAPTCHA checkbox
  const porkCaptcha = page.locator('#my-porkcaptcha_accountLogin');
  const box = await porkCaptcha.boundingBox();
  if (box) {
    await page.mouse.click(box.x + 28, box.y + box.height / 2);
    console.log('Clicked captcha checkbox');
    await page.waitForTimeout(15000);
  }

  // Check captcha solved
  const porkToken = await page.locator('#porkcaptcha-token_accountLogin').inputValue().catch(() => '');
  if (!porkToken) {
    console.log('ERROR: Captcha not solved, cannot proceed');
    await browser.close();
    return;
  }
  console.log('Captcha solved!');

  // Click Login button
  const loginBtn = page.locator('button:has-text("Login")');
  await loginBtn.click();
  console.log('Clicked Login button');
  
  // Wait for redirect
  await page.waitForTimeout(10000);
  
  const currentUrl = page.url();
  console.log('Current URL after login:', currentUrl);
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/porkbun_after_login.png' });

  // Check if login was successful
  const bodyText = await page.innerText('body').catch(() => '');
  if (bodyText.includes('Invalid') || bodyText.includes('incorrect') || bodyText.includes('error')) {
    console.log('Login may have failed. Body text:', bodyText.substring(0, 500));
  }

  // ===== STEP 2: NAVIGATE TO DNS PAGE =====
  console.log('\n=== STEP 2: NAVIGATE TO DNS PAGE ===');
  await page.goto('https://porkbun.com/management/dns/sona.support', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  
  console.log('DNS Page URL:', page.url());
  await page.screenshot({ path: '/tmp/porkbun_dns_before.png' });

  // Check existing DNS records
  const dnsBodyText = await page.innerText('body').catch(() => '');
  console.log('DNS page text (first 2000):', dnsBodyText.substring(0, 2000));

  // ===== STEP 3: CHECK EXISTING RECORDS =====
  console.log('\n=== STEP 3: CHECK EXISTING RECORDS ===');
  
  // Look for existing records table
  const records = await page.locator('tr, [class*=record], [class*=dns]').all();
  console.log('Found elements that might be records:', records.length);

  // Try to find the DNS records in a more structured way
  const pageHTML = await page.content();
  
  // Check if our target records already exist
  const hasDKIM = pageHTML.includes('resend._domainkey');
  const hasSendMX = pageHTML.includes('send') && pageHTML.includes('feedback-smtp');
  const hasSendTXT = pageHTML.includes('send') && pageHTML.includes('v=spf1');
  
  console.log('DKIM record exists:', hasDKIM);
  console.log('Send MX record exists:', hasSendMX);
  console.log('Send TXT record exists:', hasSendTXT);

  // Save the full state for analysis
  await page.screenshot({ path: '/tmp/porkbun_dns_page.png', fullPage: true });

  // ===== STEP 4: ADD DNS RECORDS =====
  console.log('\n=== STEP 4: ADD DNS RECORDS ===');

  // Function to add a DNS record
  async function addDNSRecord(type, name, content, priority) {
    console.log(`\nAdding ${type} record: ${name} -> ${content.substring(0, 50)}...`);
    
    // Look for the "Add Record" button/section
    try {
      // First, find and click the type dropdown
      const typeSelect = page.locator('select[id*=type], select[name*=type], [class*=type] select').first();
      if (await typeSelect.isVisible({ timeout: 3000 })) {
        await typeSelect.selectOption(type);
        console.log('Selected type:', type);
      } else {
        // Try clicking a type selector
        const typeBtn = page.locator(`button:has-text("${type}"), [data-type="${type}"]`).first();
        if (await typeBtn.isVisible({ timeout: 3000 })) {
          await typeBtn.click();
          console.log('Clicked type button:', type);
        }
      }
    } catch(e) {
      console.log('Type selection failed:', e.message.substring(0, 100));
    }
    
    await page.waitForTimeout(1000);
    
    // Fill in the name/subdomain
    try {
      const nameInput = page.locator('input[id*=name], input[name*=name], input[placeholder*="name"], input[placeholder*="subdomain"]').first();
      if (await nameInput.isVisible({ timeout: 3000 })) {
        await nameInput.fill(name);
        console.log('Filled name:', name);
      }
    } catch(e) {
      console.log('Name fill failed:', e.message.substring(0, 100));
    }
    
    // Fill in the content/value
    try {
      const contentInput = page.locator('input[id*=content], input[name*=content], input[id*=value], input[name*=value], input[placeholder*="content"], input[placeholder*="value"], textarea[id*=content], textarea[name*=content]').first();
      if (await contentInput.isVisible({ timeout: 3000 })) {
        await contentInput.fill(content);
        console.log('Filled content');
      }
    } catch(e) {
      console.log('Content fill failed:', e.message.substring(0, 100));
    }
    
    // Fill priority for MX records
    if (priority) {
      try {
        const priorityInput = page.locator('input[id*=priority], input[name*=priority], input[placeholder*="priority"]').first();
        if (await priorityInput.isVisible({ timeout: 3000 })) {
          await priorityInput.fill(String(priority));
          console.log('Filled priority:', priority);
        }
      } catch(e) {
        console.log('Priority fill failed:', e.message.substring(0, 100));
      }
    }
    
    await page.waitForTimeout(1000);
    
    // Click the add/save button
    try {
      const addBtn = page.locator('button:has-text("Add"), button:has-text("Save"), button:has-text("Create"), input[type=submit]').first();
      if (await addBtn.isVisible({ timeout: 3000 })) {
        await addBtn.click();
        console.log('Clicked Add button');
        await page.waitForTimeout(5000);
      }
    } catch(e) {
      console.log('Add button click failed:', e.message.substring(0, 100));
    }
    
    await page.screenshot({ path: `/tmp/porkbun_add_${type}_${name.replace(/[^a-zA-Z0-9]/g, '_')}.png` });
  }

  // Let me first examine the DNS page structure more carefully
  console.log('\nExamining DNS page structure...');
  
  // Find all interactive elements on the page
  const allInputs = await page.locator('input, select, textarea, button').all();
  for (const el of allInputs) {
    const tag = await el.evaluate(e => e.tagName);
    const type = await el.getAttribute('type').catch(() => '');
    const name = await el.getAttribute('name').catch(() => '');
    const id = await el.getAttribute('id').catch(() => '');
    const placeholder = await el.getAttribute('placeholder').catch(() => '');
    const text = await el.innerText().catch(() => '');
    const visible = await el.isVisible().catch(() => false);
    console.log(`Element: ${tag} type=${type} name=${name} id=${id} placeholder=${placeholder} text=${text.substring(0, 30)} visible=${visible}`);
  }

  await browser.close();
})();
