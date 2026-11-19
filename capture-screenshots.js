const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  // Create screenshots directory
  const screenshotDir = '/home/node/AppuBot/appu/gta6-build/screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  
  console.log('Navigating to game...');
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 60000 });
  
  // Wait for loading screen to disappear
  await page.waitForSelector('#loading-screen.hidden', { timeout: 60000 });
  
  // Wait a bit more for game to fully initialize
  await page.waitForTimeout(3000);
  
  console.log('Game loaded, capturing screenshots...');
  
  // Helper to trigger screenshot and wait
  async function captureShot(shotName, filename) {
    // Click the screenshot button
    await page.click(`button[data-shot="${shotName}"]`);
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await page.screenshot({ path: path.join(screenshotDir, filename), fullPage: true });
    console.log(`Captured ${filename}`);
  }
  
  // Capture all 4 screenshots
  await captureShot('cover', 'cover.png');
  await captureShot('city', 'city.png');
  await captureShot('chase', 'chase.png');
  await captureShot('arrest', 'arrest.png');
  
  await browser.close();
  console.log('All screenshots captured!');
}

captureScreenshots().catch(console.error);