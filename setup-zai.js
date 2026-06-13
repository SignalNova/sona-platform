const fs = require('fs');
const cfg = {
  baseUrl: process.env.ZAI_BASE_URL || 'https://internal-api.z.ai/v1',
  apiKey: process.env.ZAI_API_KEY || 'Z.ai',
  chatId: process.env.ZAI_CHAT_ID || '',
  token: process.env.ZAI_TOKEN || '',
  userId: process.env.ZAI_USER_ID || ''
};
fs.writeFileSync('.z-ai-config', JSON.stringify(cfg));
console.log('[ZAI] Config written successfully');
