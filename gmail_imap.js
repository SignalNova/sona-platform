const { ImapFlow } = require('imapflow');
const net = require('net');

async function testConnection() {
  return new Promise((resolve) => {
    const socket = net.createConnection(993, 'imap.gmail.com', () => {
      console.log('Connected to imap.gmail.com:993');
      socket.destroy();
      resolve(true);
    });
    socket.setTimeout(10000);
    socket.on('timeout', () => {
      console.log('Connection to imap.gmail.com:993 timed out');
      socket.destroy();
      resolve(false);
    });
    socket.on('error', (err) => {
      console.log('Connection error:', err.message);
      socket.destroy();
      resolve(false);
    });
  });
}

testConnection().then(connected => {
  if (connected) {
    console.log('IMAP connection possible!');
  } else {
    console.log('IMAP connection not possible from this server');
  }
});
