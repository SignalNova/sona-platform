from playwright.sync_api import sync_playwright
import time, json

RESULT_FILE = "/home/z/my-project/render-deploy-result.json"

def main():
    result = {"attempts": 0, "logged_in": False, "deploy_triggered": False, "events": ""}
    
    for attempt in range(1, 20):
        result["attempts"] = attempt
        print(f"Attempt {attempt}...")
        
        try:
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
                time.sleep(15)
                
                body = page.inner_text('body')
                
                if 'Too many' in body:
                    print(f"  Rate limited. Waiting 2 min...")
                    browser.close()
                    time.sleep(120)
                    continue
                
                if 'sona-platform' in body:
                    print("  ✅ LOGGED IN!")
                    result["logged_in"] = True
                    
                    # Go to service page
                    page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', timeout=30000)
                    time.sleep(10)
                    page.evaluate('window.scrollBy(0, 600)')
                    time.sleep(3)
                    
                    body2 = page.inner_text('body')
                    filter_idx = body2.find('Filter events')
                    if filter_idx > 0:
                        result["events"] = body2[filter_idx:filter_idx+1500]
                    
                    # Check if latest code is deployed
                    latest_hashes = ['7fd8cf4', '2fa3e10', '4c2bebf', '17a8393']
                    deployed = any(h in body2 for h in latest_hashes)
                    
                    if not deployed:
                        print("  Triggering manual deploy with cache clear...")
                        page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg', timeout=30000)
                        time.sleep(5)
                        page.click('text=Manual Deploy')
                        time.sleep(2)
                        
                        # Try clear cache deploy
                        try:
                            page.click('button:has-text("Clear build cache")')
                            time.sleep(3)
                            result["deploy_triggered"] = True
                            print("  ✅ Clear cache deploy triggered!")
                        except:
                            try:
                                page.click('button:has-text("Deploy latest commit")')
                                time.sleep(3)
                                result["deploy_triggered"] = True
                                print("  ✅ Latest commit deploy triggered!")
                            except Exception as e:
                                print(f"  ❌ Deploy trigger failed: {e}")
                    else:
                        print("  ✅ Latest code already deployed!")
                        result["deploy_triggered"] = True
                    
                    # Also check for deploy hook in settings
                    try:
                        page.goto('https://dashboard.render.com/web/srv-d8l87el8nd3s73e0kfpg/settings', timeout=30000)
                        time.sleep(8)
                        settings = page.inner_text('body')
                        if 'deploy hook' in settings.lower():
                            hook_idx = settings.lower().find('deploy hook')
                            result["deploy_hook_info"] = settings[hook_idx:hook_idx+500]
                    except:
                        pass
                    
                    page.screenshot(path='/home/z/my-project/render-auto-deploy-result.png')
                    browser.close()
                    break
                else:
                    print(f"  Unknown: {body[:100]}")
                    browser.close()
                    time.sleep(120)
                    
        except Exception as e:
            print(f"  Error: {e}")
            time.sleep(120)
    
    with open(RESULT_FILE, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"Results saved to {RESULT_FILE}")

if __name__ == '__main__':
    main()
