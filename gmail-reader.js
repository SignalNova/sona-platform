const imaps = require('imap-simple');

async function getLatestPorkbunCode() {
  const config = {
    imap: {
      user: 'helpsona.support@gmail.com',
      password: 'pceh qeww yron fbsi',
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000
    }
  };

  try {
    console.log('Connecting to Gmail IMAP...');
    const connection = await imaps.connect(config);
    console.log('Connected!');
    
    await connection.openBox('INBOX');
    console.log('Inbox opened');
    
    // Search for recent Porkbun emails
    const searchCriteria = ['UNSEEN', ['FROM', 'porkbun']];
    const fetchOptions = { bodies: ['TEXT'], struct: true };
    
    // Also try broader search
    const messages = await connection.search(['ALL'], fetchOptions);
    console.log('Total messages:', messages.length);
    
    // Get the most recent messages
    const recentMessages = await connection.search(
      ['FROM', 'porkbun'], 
      fetchOptions
    );
    console.log('Porkbun messages:', recentMessages.length);
    
    // If no porkbun messages, get latest emails
    const latestMessages = await connection.search(
      ['ALL'], 
      { bodies: ['HEADER', 'TEXT'], struct: true }
    );
    
    // Read last 5 messages
    for (let i = Math.max(0, latestMessages.length - 5); i < latestMessages.length; i++) {
      const msg = latestMessages[i];
      const header = msg.parts.filter(p => p.which === 'HEADER')[0];
      const text = msg.parts.filter(p => p.which === 'TEXT')[0];
      
      if (header) {
        const subjectMatch = header.body.match(/Subject: (.+)/i);
        const fromMatch = header.body.match(/From: (.+)/i);
        console.log('---');
        console.log('From:', fromMatch ? fromMatch[1] : 'unknown');
        console.log('Subject:', subjectMatch ? subjectMatch[1] : 'unknown');
        
        if (text) {
          const body = text.body.substring(0, 500);
          console.log('Body (first 500):', body);
          
          // Look for 6-digit code
          const codeMatch = body.match(/\b(\d{6})\b/);
          if (codeMatch) {
            console.log('FOUND CODE:', codeMatch[1]);
          }
        }
      }
    }
    
    await connection.end();
    console.log('Done!');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getLatestPorkbunCode();
