import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

async function captureScreenshots() {
  const screenshotDir = '/home/node/AppuBot/appu/gta6-build/screenshots';
  if (!existsSync(screenshotDir)) {
    mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  console.log('Navigating to game...');
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 120000 });

  // Wait additional time for game to initialize
  console.log('Waiting 10s for game init...');
  await page.waitForTimeout(10000);

  // Hide the loading screen so it doesn't intercept clicks
  console.log('Hiding loading screen...');
  await page.evaluate(() => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
    }
  });

  // Small additional wait for any transitions
  await page.waitForTimeout(2000);

  console.log('Game loaded, capturing screenshots...');

  async function captureShot(shotName, filename) {
    // Take screenshot directly - button click may be unreliable with loading screen
    await page.screenshot({ path: join(screenshotDir, filename), fullPage: false });
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