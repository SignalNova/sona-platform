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

  // Now on 2FA page
  // Let me look for hidden elements that might be the "use another method" links
  const hiddenElements = await page.evaluate(() => {
    const elements = document.querySelectorAll('a, button');
    const results = [];
    for (const el of elements) {
      const text = el.textContent?.trim();
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (text && (text.includes('use another') || text.includes('SMS') || text.includes('send SMS') || text.includes('use email'))) {
        results.push({
          tag: el.tagName,
          text: text.substring(0, 100),
          id: el.id,
          className: el.className?.substring(0, 100),
          visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
          display: style.display,
          visibility: style.visibility,
          position: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
          parentVisible: (() => {
            const parent = el.parentElement;
            if (!parent) return true;
            const ps = window.getComputedStyle(parent);
            return ps.display !== 'none' && ps.visibility !== 'hidden';
          })()
        });
      }
    }
    return results;
  });
  
  console.log('Hidden elements related to 2FA methods:', JSON.stringify(hiddenElements, null, 2));

  // Try to find and make visible the "use another method" link
  const anotherMethodResult = await page.evaluate(() => {
    // Find all links and buttons
    const elements = document.querySelectorAll('a, button, [role=button]');
    for (const el of elements) {
      if (el.textContent?.includes('use another method')) {
        // Make it visible by changing styles
        el.style.display = 'block';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        
        // Also check parent visibility
        let parent = el.parentElement;
        while (parent) {
          const style = window.getComputedStyle(parent);
          if (style.display === 'none') {
            parent.style.display = 'block';
          }
          if (style.visibility === 'hidden') {
            parent.style.visibility = 'visible';
          }
          parent = parent.parentElement;
        }
        
        return { found: true, text: el.textContent.trim(), id: el.id, className: el.className?.substring(0, 100) };
      }
    }
    return { found: false };
  });
  
  console.log('Another method element:', JSON.stringify(anotherMethodResult));

  // If found, try to click it
  if (anotherMethodResult.found) {
    // Re-query for the visible element
    const anotherMethodLinks = await page.locator('a:has-text("use another method"), button:has-text("use another method")').all();
    for (const link of anotherMethodLinks) {
      const visible = await link.isVisible({ timeout: 2000 }).catch(() => false);
      if (visible) {
        console.log('Clicking "use another method"');
        await link.click();
        await new Promise(r => setTimeout(r, 3000));
        
        const bodyText = await page.innerText('body').catch(() => '');
        console.log('After click (first 1000):', bodyText.substring(0, 1000));
        break;
      }
    }
    
    // If still not visible, try JavaScript click
    const jsClickResult = await page.evaluate(() => {
      const elements = document.querySelectorAll('a, button, [role=button]');
      for (const el of elements) {
        if (el.textContent?.includes('use another method')) {
          el.click();
          return 'clicked';
        }
      }
      return 'not found';
    });
    console.log('JS click result:', jsClickResult);
    await new Promise(r => setTimeout(r, 3000));
    
    const bodyText = await page.innerText('body').catch(() => '');
    console.log('After JS click (first 1000):', bodyText.substring(0, 1000));
  }

  await page.screenshot({ path: '/tmp/porkbun_2fa_explore.png' });
  await browser.close();
})();
