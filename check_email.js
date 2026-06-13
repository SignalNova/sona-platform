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
    logger: false
  });

  try {
    await client.connect();
    console.log('Connected to Gmail IMAP!');
    
    let lock = await client.getMailboxLock('INBOX');
    try {
      // Search for recent emails from Porkbun
      const messages = await client.search({ 
        from: 'porkbun',
        since: new Date(Date.now() - 30 * 60 * 1000) // last 30 minutes
      });
      console.log('Found Porkbun messages:', messages.length);
      
      if (messages.length > 0) {
        // Get the latest message
        const latestMsg = messages[messages.length - 1];
        const msg = await client.fetchOne(latestMsg, { source: true });
        const body = msg.source.toString();
        console.log('Latest Porkbun email (first 2000):', body.substring(0, 2000));
        
        // Try to extract the code
        const codeMatch = body.match(/\b(\d{6})\b/);
        if (codeMatch) {
          console.log('VERIFICATION CODE:', codeMatch[1]);
        }
      } else {
        // Try broader search
        const allRecent = await client.search({ 
          since: new Date(Date.now() - 30 * 60 * 1000)
        });
        console.log('All recent messages:', allRecent.length);
        
        for (const msgId of allRecent.slice(-5)) {
          const msg = await client.fetchOne(msgId, { envelope: true });
          console.log('Message:', msg.envelope.from[0].address, msg.envelope.subject);
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
