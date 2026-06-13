// Gmail API OAuth2 Setup Helper
// This script helps set up Gmail API OAuth2 credentials
// 
// PREREQUISITES:
// 1. Go to https://console.cloud.google.com/
// 2. Create a new project (e.g., "SONA Email Service")
// 3. Enable Gmail API: https://console.cloud.google.com/apis/library/gmail.googleapis.com
// 4. Create OAuth2 credentials:
//    - Go to https://console.cloud.google.com/apis/credentials
//    - Click "Create Credentials" > "OAuth client ID"
//    - Application type: "Web application"
//    - Authorized redirect URIs: Add "https://developers.google.com/oauthplayground"
//    - Copy the Client ID and Client Secret
// 5. Go to https://developers.google.com/oauthplayground
//    - Click the gear icon (OAuth 2.0 configuration)
//    - Check "Use your own OAuth credentials"
//    - Enter Client ID and Client Secret
//    - In "Select the API" section, find "Gmail API v1" and select "https://mail.google.com/"
//    - Click "Authorize APIs"
//    - Sign in with helpsona.support@gmail.com
//    - Click "Exchange authorization code for tokens"
//    - Copy the Refresh Token
// 6. Set environment variables:
//    GMAIL_CLIENT_ID=your_client_id
//    GMAIL_CLIENT_SECRET=your_client_secret
//    GMAIL_REFRESH_TOKEN=your_refresh_token

console.log('Gmail API OAuth2 Setup Instructions:');
console.log('====================================');
console.log('');
console.log('1. Go to: https://console.cloud.google.com/projectcreate');
console.log('   - Create project "SONA Email Service"');
console.log('');
console.log('2. Enable Gmail API: https://console.cloud.google.com/apis/library/gmail.googleapis.com');
console.log('   - Click "Enable"');
console.log('');
console.log('3. Create OAuth2 credentials: https://console.cloud.google.com/apis/credentials/oauthclient');
console.log('   - Application type: Web application');
console.log('   - Authorized redirect URIs: https://developers.google.com/oauthplayground');
console.log('   - Copy Client ID and Client Secret');
console.log('');
console.log('4. Get Refresh Token: https://developers.google.com/oauthplayground');
console.log('   - Click gear icon, check "Use your own OAuth credentials"');
console.log('   - Enter Client ID and Client Secret');
console.log('   - Select "Gmail API v1" > "https://mail.google.com/"');
console.log('   - Click "Authorize APIs", sign in, exchange code for tokens');
console.log('   - Copy Refresh Token');
console.log('');
console.log('5. Add to Render environment variables:');
console.log('   GMAIL_CLIENT_ID=your_client_id');
console.log('   GMAIL_CLIENT_SECRET=your_client_secret');
console.log('   GMAIL_REFRESH_TOKEN=your_refresh_token');
