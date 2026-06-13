const { ImapFlow } = require('imapflow');

async function readGmail() {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: 'helpsona.support@gmail.com',
      pass: 'pceh qeww yron fbsi'
    },
    tls: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Gmail!');
    
    let lock = await client.getMailboxLock('INBOX');
    try {
      // Search for recent emails
      const messages = await client.search({ from: 'porkbun' });
      console.log('Porkbun emails found:', messages.length);
      
      if (messages.length > 0) {
        // Get the latest one
        const latest = messages[messages.length - 1];
        const msg = await client.fetchOne(latest, { source: true });
        const body = msg.source.toString();
        console.log('Latest email (first 1000):', body.substring(0, 1000));
        
        // Extract code
        const codeMatch = body.match(/\b(\d{6})\b/);
        if (codeMatch) {
          console.log('VERIFICATION CODE:', codeMatch[1]);
        }
      } else {
        // Get latest 3 emails
        const allMsgs = await client.search({ all: true });
        console.log('Total emails:', allMsgs.length);
        
        for (let i = Math.max(0, allMsgs.length - 3); i < allMsgs.length; i++) {
          const msg = await client.fetchOne(allMsgs[i], { envelope: true, source: true });
          console.log('---');
          console.log('From:', msg.envelope.from[0]?.address);
          console.log('Subject:', msg.envelope.subject);
          const body = msg.source.toString().substring(0, 500);
          const codeMatch = body.match(/\b(\d{6})\b/);
          if (codeMatch) console.log('CODE:', codeMatch[1]);
        }
      }
    } finally {
      lock.release();
    }
    
    await client.logout();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

readGmail();
