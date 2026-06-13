const { ImapFlow } = require('imapflow');

async function main() {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: 'helpsona.support@gmail.com',
      pass: '*R^,6Nc($8H7T*X'
    },
    logger: false,
    connectTimeout: 30000,
    greetingTimeout: 30000
  });

  try {
    await client.connect();
    console.log('Connected to Gmail IMAP!');
    
    let lock = await client.getMailboxLock('INBOX');
    try {
      // Search for recent emails from Porkbun
      const messages = await client.search({ 
        from: 'porkbun',
        since: new Date(Date.now() - 60 * 60 * 1000) // last 60 minutes
      });
      console.log('Found Porkbun messages:', messages.length);
      
      if (messages.length > 0) {
        // Get the latest message
        for (const msgId of messages.slice(-3)) {
          const msg = await client.fetchOne(msgId, { source: true });
          const body = msg.source.toString();
          console.log('--- Message ---');
          console.log('Message (first 3000):', body.substring(0, 3000));
          
          // Try to extract the code
          const codeMatch = body.match(/\b(\d{6})\b/);
          if (codeMatch) {
            console.log('*** VERIFICATION CODE ***:', codeMatch[1]);
          }
        }
      } else {
        // Try broader search
        const allRecent = await client.search({ 
          since: new Date(Date.now() - 60 * 60 * 1000)
        });
        console.log('All recent messages:', allRecent.length);
        
        for (const msgId of allRecent.slice(-10)) {
          const msg = await client.fetchOne(msgId, { envelope: true });
          console.log('Message from:', msg.envelope.from[0].address, 'Subject:', msg.envelope.subject);
        }
      }
    } finally {
      lock.release();
    }
    
    await client.logout();
  } catch(e) {
    console.log('IMAP Error:', e.message);
  }
}

main();
