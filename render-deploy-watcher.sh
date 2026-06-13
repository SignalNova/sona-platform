#!/bin/bash
# This script waits for Render rate limit to expire, then logs in and checks deploy status
# It writes results to /home/z/my-project/render-deploy-result.txt

RESULT_FILE="/home/z/my-project/render-deploy-result.txt"

echo "Starting Render deploy watcher at $(date)" > "$RESULT_FILE"

# Wait for rate limit to expire (total ~25 minutes from first rate limit)
echo "Waiting for rate limit to expire..." >> "$RESULT_FILE"
sleep 600  # Wait 10 minutes

echo "Attempting login at $(date)..." >> "$RESULT_FILE"

python3 << 'PYEOF'
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()
    
    page.goto('https://dashboard.render.com/login', timeout=30000)
    time.sleep(5)
    
    body = page.inner_text('body')
    
    if 'Too many' in body:
        with open('/home/z/my-project/render-deploy-result.txt', 'a') as f:
            f.write('STILL_RATE_LIMITED\n')
        browser.close()
        exit()
    
    page.locator('input[name="email"]').click()
    page.keyboard.type('helpsona.support@gmail.com', delay=200)
    time.sleep(1)
    page.locator('input[name="password"]').click()
    page.keyboard.type('*R^,6Nc($8H7T*X', delay=200)
    time.sleep(1)
    page.locator('button[type="submit"]').click()
    time.sleep(15)
    
    body = page.inner_text('body')
    
    if 'Too many' in body:
        with open('/home/z/my-project/render-deploy-result.txt', 'a') as f:
            f.write('RATE_LIMITED_AFTER_LOGIN\n')
        browser.close()
        exit()
    
    if 'sona-platform' not in body:
        with open('/home/z/my-project/render-deploy-result.txt', 'a') as f:
            f.write(f'LOGIN_FAILED: {body[:200]}\n')
        browser.close()
        exit()
    
    with open('/home/z/my-project/render-deploy-result.txt', 'a') as f:
        f.write('LOGGED_IN_SUCCESS\n')
    
    # Go to service page
    page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', timeout=30000)
    time.sleep(10)
    page.evaluate('window.scrollBy(0, 600)')
    time.sleep(3)
    
    body2 = page.inner_text('body')
    filter_idx = body2.find('Filter events')
    
    with open('/home/z/my-project/render-deploy-result.txt', 'a') as f:
        if filter_idx > 0:
            f.write(body2[filter_idx:filter_idx+2000] + '\n')
        else:
            f.write(body2[:2000] + '\n')
    
    # Check if we need to trigger another deploy
    # Look for the latest commit hash in the events
    if '7fd8cf4' not in body2 and '2fa3e10' not in body2:
        with open('/home/z/my-project/render-deploy-result.txt', 'a') as f:
            f.write('NEEDS_MANUAL_DEPLOY\n')
        
        # Click Manual Deploy
        try:
            page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', timeout=30000)
            time.sleep(5)
            page.click('text=Manual Deploy')
            time.sleep(2)
            page.click('button:has-text("Deploy latest commit")')
            time.sleep(5)
            with open('/home/z/my-project/render-deploy-result.txt', 'a') as f:
                f.write('MANUAL_DEPLOY_TRIGGERED\n')
        except Exception as e:
            with open('/home/z/my-project/render-deploy-result.txt', 'a') as f:
                f.write(f'DEPLOY_TRIGGER_FAILED: {e}\n')
    else:
        with open('/home/z/my-project/render-deploy-result.txt', 'a') as f:
            f.write('DEPLOY_ALREADY_DONE_OR_IN_PROGRESS\n')
    
    page.screenshot(path='/home/z/my-project/render-deploy-watcher.png')
    browser.close()
PYEOF

echo "Script completed at $(date)" >> "$RESULT_FILE"
