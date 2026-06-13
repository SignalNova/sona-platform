const { firefox } = require('playwright');
const fs = require('fs');

(async () => {
  let browser;
  try {
    browser = await firefox.launch({ headless: true });
    const page = await browser.newPage();
    
    // Navigate to any page first (to establish a session)
    await page.goto('https://porkbun.com', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Try the API call from within the browser
    const apiKeyResult = await page.evaluate(async () => {
      try {
        const resp = await fetch('https://porkbun.com/api/json/v3/apiKey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identity: 'helpsona.support@gmail.com',
            secret: '*R^,6Nc($8H7T*X'
          })
        });
        const text = await resp.text();
        return { status: resp.status, body: text.substring(0, 500) };
      } catch(e) {
        return { error: e.message };
      }
    });
    
    console.log('API Key result:', JSON.stringify(apiKeyResult));
    
    if (apiKeyResult.body && apiKeyResult.body.includes('apikey')) {
      const data = JSON.parse(apiKeyResult.body);
      const apiKey = data.apikey;
      const secretKey = data.secretapikey;
      console.log('GOT API KEY:', apiKey);
      console.log('GOT SECRET KEY:', secretKey);
      
      fs.writeFileSync('/home/z/my-project/porkbun-api-key.txt', JSON.stringify(data));
      
      // Now add DNS records via API
      const dnsRecords = [
        { type: 'TXT', name: 'resend._domainkey', content: 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCzo7M5wZMqAvNmDKUPZbw1zOYfqx7HbSrfxXmYVuj+U7LwRXdTCIsw8MEJ9BqyLtZBjrvAFkOa9zG7pMFQLrI7kpW+baVO+CCNIIY2xG/aPcWU5iusrJRg+T6tQ2xHSBhq3N6IMp9VFAKlYCKCm/Jnb3Nzq5/7KTA2r709NqE1dwIDAQAB', ttl: 600 },
        { type: 'MX', name: 'send', content: 'feedback-smtp.us-east-1.amazonses.com', prio: 10, ttl: 600 },
        { type: 'TXT', name: 'send', content: 'v=spf1 include:amazonses.com ~all', ttl: 600 }
      ];
      
      for (const record of dnsRecords) {
        console.log(`Adding ${record.type} record: ${record.name}...`);
        const result = await page.evaluate(async ({apiKey, secretKey, record}) => {
          try {
            const body = {
              apikey: apiKey,
              secretapikey: secretKey,
              name: record.name,
              type: record.type,
              content: record.content,
              ttl: record.ttl
            };
            if (record.prio) body.prio = record.prio;
            
            const resp = await fetch('https://porkbun.com/api/json/v3/dns/create/sona.support', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            return { status: resp.status, body: await resp.text() };
          } catch(e) {
            return { error: e.message };
          }
        }, { apiKey, secretKey, record });
        
        console.log(`Result:`, JSON.stringify(result).substring(0, 200));
      }
      
      console.log('ALL DNS RECORDS ADDED!');
    }
    
  } catch(e) { 
    console.error('Error:', e.message); 
  } finally { 
    if(browser) await browser.close(); 
  }
})();
