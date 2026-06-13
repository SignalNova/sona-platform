const net = require('net');
const tls = require('tls');

async function tryGmailIMAP() {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: 'imap.gmail.com',
      port: 993,
      rejectUnauthorized: true
    }, () => {
      console.log('Connected to Gmail IMAP');
      
      let data = '';
      socket.on('data', (chunk) => {
        data += chunk.toString();
        console.log('Received:', chunk.toString().substring(0, 200));
        
        if (data.includes('* OK')) {
          // Send login command
          const loginCmd = 'a1 LOGIN "helpsona.support@gmail.com" "*R^,6Nc($8H7T*X"\r\n';
          console.log('Sending login...');
          socket.write(loginCmd);
        }
        
        if (data.includes('a1 OK')) {
          console.log('LOGIN SUCCESSFUL!');
          socket.write('a2 SELECT INBOX\r\n');
        }
        
        if (data.includes('a1 NO') || data.includes('a1 BAD')) {
          console.log('Login failed:', data);
          socket.end();
          resolve(false);
        }
        
        if (data.includes('a2 OK')) {
          // Search for recent emails
          socket.write('a3 SEARCH SINCE 13-Jun-2025 FROM "porkbun"\r\n');
        }
        
        if (data.includes('a3 OK')) {
          console.log('Search results:', data);
          socket.end();
          resolve(true);
        }
      });
      
      socket.setTimeout(15000);
      socket.on('timeout', () => {
        console.log('Socket timeout');
        socket.end();
        resolve(false);
      });
      
      socket.on('error', (err) => {
        console.log('Socket error:', err.message);
        resolve(false);
      });
    });
  });
}

tryGmailIMAP().then(result => {
  console.log('Result:', result);
});
