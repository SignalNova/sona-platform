#!/bin/bash
# Persistent script to deploy on Render
# Keeps trying until successful or 30 attempts

LOG="/home/z/my-project/deploy-log.txt"
echo "$(date): Starting persistent deploy script" > "$LOG"

ATTEMPT=0
MAX=30

while [ $ATTEMPT -lt $MAX ]; do
    ATTEMPT=$((ATTEMPT + 1))
    echo "$(date): Attempt $ATTEMPT/$MAX" >> "$LOG"
    
    RESULT=$(python3 << 'PYEOF'
from playwright.sync_api import sync_playwright
import time

result = "UNKNOWN"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()
    
    try:
        page.goto('https://dashboard.render.com/login', timeout=30000)
        time.sleep(5)
        
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
            result = "RATE_LIMITED"
        elif 'sona-platform' in body:
            result = "LOGGED_IN"
            
            # Go to service page
            page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', timeout=30000)
            time.sleep(10)
            page.evaluate('window.scrollBy(0, 600)')
            time.sleep(3)
            body2 = page.inner_text('body')
            
            # Check if new deploy is there
            if '7fd8cf4' in body2 or '2fa3e10' in body2:
                result = "ALREADY_DEPLOYED"
            else:
                # Trigger manual deploy with cache clear
                try:
                    page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', timeout=30000)
                    time.sleep(5)
                    page.click('text=Manual Deploy')
                    time.sleep(2)
                    page.click('button:has-text("Clear build cache")')
                    time.sleep(5)
                    result = "DEPLOY_TRIGGERED_CACHE_CLEAR"
                except:
                    try:
                        page.click('button:has-text("Deploy latest commit")')
                        time.sleep(5)
                        result = "DEPLOY_TRIGGERED"
                    except:
                        result = "DEPLOY_FAILED"
            
            page.screenshot(path='/home/z/my-project/deploy-screenshot.png')
            
            # Save events
            with open('/home/z/my-project/deploy-events.txt', 'w') as f:
                filter_idx = body2.find('Filter events')
                if filter_idx > 0:
                    f.write(body2[filter_idx:filter_idx+2000])
                else:
                    f.write(body2[:2000])
        else:
            result = f"OTHER: {body[:100]}"
    except Exception as e:
        result = f"ERROR: {e}"
    finally:
        browser.close()

print(result)
PYEOF
)
    
    echo "$(date): Result: $RESULT" >> "$LOG"
    
    if [[ "$RESULT" == *"LOGGED_IN"* ]] || [[ "$RESULT" == *"DEPLOY"* ]] || [[ "$RESULT" == *"ALREADY"* ]]; then
        echo "$(date): SUCCESS! Result: $RESULT" >> "$LOG"
        echo "$RESULT" > /home/z/my-project/deploy-status.txt
        exit 0
    fi
    
    # Wait 2 minutes before next attempt
    sleep 120
done

echo "$(date): All attempts exhausted" >> "$LOG"
echo "EXHAUSTED" > /home/z/my-project/deploy-status.txt
