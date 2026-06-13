const net = require('net');
const tls = require('tls');

async function tryGmailIMAP() {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: 'imap.gmail.com',
      port: 993,
      rejectUnauthorized: false
    }, () => {
      console.log('Connected to Gmail IMAP');
      
      let dataBuffer = '';
      let loginSent = false;
      
      socket.on('data', (chunk) => {
        dataBuffer += chunk.toString();
        console.log('Received:', chunk.toString().substring(0, 300));
        
        if (!loginSent && dataBuffer.includes('* OK')) {
          loginSent = true;
          const loginCmd = 'a1 LOGIN "helpsona.support@gmail.com" "*R^,6Nc($8H7T*X"\r\n';
          console.log('Sending login...');
          socket.write(loginCmd);
        }
        
        if (dataBuffer.includes('a1 OK')) {
          console.log('LOGIN SUCCESSFUL!');
          socket.end();
          resolve(true);
        }
        
        if (dataBuffer.includes('a1 NO') || dataBuffer.includes('a1 BAD')) {
          console.log('Login failed - Google likely requires OAuth2 for IMAP');
          socket.end();
          resolve(false);
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
