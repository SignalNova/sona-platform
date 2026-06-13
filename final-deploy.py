#!/usr/bin/env python3
"""Wait for Render rate limit, login, and trigger cache-clear deploy."""
import time, sys
from playwright.sync_api import sync_playwright

RESULT_FILE = '/home/z/my-project/deploy-final-status.txt'

def log(msg):
    with open(RESULT_FILE, 'a') as f:
        f.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")
    print(msg, flush=True)

# Wait 10 minutes for rate limit
log("Waiting 10 minutes for Render rate limit to expire...")
sys.stdout.flush()

for i in range(10):
    time.sleep(60)
    log(f"  {i+1}/10 minutes waited...")

log("Attempting login...")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()
    
    page.goto('https://dashboard.render.com/login', timeout=30000)
    time.sleep(5)
    
    page.locator('input[name="email"]').click()
    page.keyboard.type('helpsona.support@gmail.com', delay=200)
    time.sleep(1)
    page.locator('input[name="password"]').click()
    page.keyboard.type('*R^,6Nc($8H7T*X', delay=200)
    time.sleep(1)
    page.locator('button[type="submit"]').click()
    time.sleep(20)
    
    body = page.inner_text('body')
    
    if 'Too many' in body:
        log("STILL RATE LIMITED! Waiting 5 more minutes...")
        time.sleep(300)
        
        page.goto('https://dashboard.render.com/login', timeout=30000)
        time.sleep(5)
        page.locator('input[name="email"]').click()
        page.keyboard.type('helpsona.support@gmail.com', delay=200)
        time.sleep(1)
        page.locator('input[name="password"]').click()
        page.keyboard.type('*R^,6Nc($8H7T*X', delay=200)
        time.sleep(1)
        page.locator('button[type="submit"]').click()
        time.sleep(20)
        body = page.inner_text('body')
    
    if 'Too many' in body:
        log("FAILED: Rate limit still active. Manual intervention needed.")
        browser.close()
        sys.exit(1)
    
    if 'sona-platform' not in body:
        log(f"FAILED: Login didn't work. Body: {body[:200]}")
        browser.close()
        sys.exit(1)
    
    log("✅ LOGGED IN!")
    
    # Go to service page
    page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', timeout=30000)
    time.sleep(10)
    page.evaluate('window.scrollBy(0, 600)')
    time.sleep(3)
    
    body2 = page.inner_text('body')
    filter_idx = body2.find('Filter events')
    if filter_idx > 0:
        log(body2[filter_idx:filter_idx+1500])
    
    # Check latest deploy status
    if '3f34f80' in body2:  # Our latest commit with memory fix
        log("✅ Latest code (with memory fix) is already deployed!")
    else:
        log("Triggering 'Clear build cache & deploy'...")
        page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', timeout=30000)
        time.sleep(5)
        
        # Click Manual Deploy dropdown
        page.click('text=Manual Deploy')
        time.sleep(2)
        
        # Click "Clear build cache & deploy"
        try:
            page.click('button:has-text("Clear build cache")')
            log("✅ Clear cache + deploy triggered!")
        except Exception as e:
            log(f"Cache clear button failed: {e}. Trying Deploy latest commit...")
            try:
                page.click('button:has-text("Deploy latest commit")')
                log("✅ Deploy latest commit triggered!")
            except Exception as e2:
                log(f"FAILED: Could not trigger deploy: {e2}")
        
        time.sleep(5)
    
    page.screenshot(path='/home/z/my-project/render-final-deploy.png')
    browser.close()

log("Script complete!")
