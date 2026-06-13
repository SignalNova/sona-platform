#!/bin/bash
RESULT_FILE="/home/z/my-project/render-deploy-result.txt"
echo "Starting login loop at $(date)" > "$RESULT_FILE"

for i in $(seq 1 15); do
    echo "Attempt $i at $(date)" >> "$RESULT_FILE"
    
    RESULT=$(python3 << 'PYEOF'
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
        print("RATE_LIMITED")
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
        print("RATE_LIMITED_AFTER")
        browser.close()
        exit()
    
    if 'sona-platform' in body:
        print("LOGGED_IN")
        
        # Go to service page
        page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', timeout=30000)
        time.sleep(10)
        page.evaluate('window.scrollBy(0, 600)')
        time.sleep(3)
        
        body2 = page.inner_text('body')
        
        # Check if we need to trigger deploy
        if '7fd8cf4' in body2 or '2fa3e10' in body2 or '4c2bebf' in body2:
            print("DEPLOY_DONE_OR_IN_PROGRESS")
        else:
            print("NEEDS_DEPLOY")
            # Try to trigger manual deploy
            try:
                page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', timeout=30000)
                time.sleep(5)
                page.click('text=Manual Deploy')
                time.sleep(2)
                page.click('button:has-text("Deploy latest commit")')
                time.sleep(5)
                print("DEPLOY_TRIGGERED")
            except:
                print("DEPLOY_TRIGGER_FAILED")
        
        page.screenshot(path='/home/z/my-project/render-auto-deploy.png')
    else:
        print(f"UNKNOWN: {body[:100]}")
    
    browser.close()
PYEOF
)
    
    echo "Result: $RESULT" >> "$RESULT_FILE"
    
    if [[ "$RESULT" == *"LOGGED_IN"* ]]; then
        echo "SUCCESS! Stopping loop." >> "$RESULT_FILE"
        exit 0
    fi
    
    # Wait 2 minutes before next attempt
    sleep 120
done

echo "All attempts exhausted" >> "$RESULT_FILE"
