#!/usr/bin/env python3
import time, sys
from playwright.sync_api import sync_playwright

STATUS_FILE = '/home/z/my-project/deploy-status.txt'

def log(msg):
    with open(STATUS_FILE, 'a') as f:
        f.write(f'[{time.strftime("%H:%M:%S")}] {msg}\n')
    print(msg, flush=True)

for attempt in range(1, 30):
    log(f'Attempt {attempt}')
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            page = browser.new_page()
            
            page.goto('https://dashboard.render.com/login', timeout=30000)
            time.sleep(5)
            page.locator('input[name="email"]').click()
            page.keyboard.type('helpsona.support@gmail.com', delay=300)
            time.sleep(1)
            page.locator('input[name="password"]').click()
            page.keyboard.type('*R^,6Nc($8H7T*X', delay=300)
            time.sleep(1)
            page.locator('button[type="submit"]').click()
            time.sleep(15)
            
            body = page.inner_text('body')
            
            if 'Too many' in body:
                log('Rate limited, waiting 2 min...')
                browser.close()
                time.sleep(120)
                continue
            
            if 'sona-platform' in body:
                log('LOGGED IN! Triggering deploy...')
                page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', timeout=30000)
                time.sleep(5)
                page.click('text=Manual Deploy')
                time.sleep(2)
                page.click('button:has-text("Deploy latest commit")')
                time.sleep(3)
                log('DEPLOY TRIGGERED SUCCESSFULLY!')
                browser.close()
                sys.exit(0)
            
            log(f'Unknown state: {body[:100]}')
            browser.close()
    except Exception as e:
        log(f'Error: {e}')
    
    time.sleep(120)

log('All attempts exhausted')
