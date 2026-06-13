#!/usr/bin/env python3
"""Wait for Render rate limit to expire, then login and trigger deploy."""
import time
from playwright.sync_api import sync_playwright

WAIT_MINUTES = 15  # Wait 15 minutes before first attempt
SERVICE_URL = 'https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg'
RESULT_FILE = '/home/z/my-project/deploy-result-final.txt'

def log(msg):
    print(msg, flush=True)
    with open(RESULT_FILE, 'a') as f:
        f.write(f"{time.strftime('%H:%M:%S')} - {msg}\n")

log(f"Waiting {WAIT_MINUTES} minutes for rate limit to expire...")
time.sleep(WAIT_MINUTES * 60)

log("Starting login attempt...")

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
        log("STILL RATE LIMITED after waiting. Trying again in 5 min...")
        time.sleep(300)
        
        # Second attempt
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
            log("RATE LIMIT STILL ACTIVE. Giving up for now.")
            browser.close()
            exit(1)
    
    if 'sona-platform' in body:
        log("✅ LOGGED IN!")
        
        # Go to service page
        page.goto(SERVICE_URL, timeout=30000)
        time.sleep(10)
        page.evaluate('window.scrollBy(0, 600)')
        time.sleep(3)
        
        body2 = page.inner_text('body')
        filter_idx = body2.find('Filter events')
        if filter_idx > 0:
            log(body2[filter_idx:filter_idx+1500])
        
        # Check if latest code deployed
        if '7fd8cf4' in body2 or '2fa3e10' in body2:
            log("✅ Latest code already deployed!")
        else:
            log("Triggering manual deploy with cache clear...")
            page.goto(SERVICE_URL, timeout=30000)
            time.sleep(5)
            page.click('text=Manual Deploy')
            time.sleep(2)
            try:
                page.click('button:has-text("Clear build cache")')
                log("✅ Cache clear + deploy triggered!")
            except:
                page.click('button:has-text("Deploy latest commit")')
                log("✅ Deploy latest commit triggered!")
            time.sleep(5)
        
        page.screenshot(path='/home/z/my-project/render-wait-deploy.png')
    else:
        log(f"Unknown: {body[:200]}")
    
    browser.close()

log("Script complete!")
