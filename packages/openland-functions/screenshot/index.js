const puppeteer = require('puppeteer');
let page;

async function getBrowserPage() {
  // Launch headless Chrome. Turn off sandbox so Chrome can run under root.
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  return browser.newPage();
}

exports.makeScreenshot = async (req, res) => {

  if (!page) {
    page = await getBrowserPage();
  }

  const url = req.body.url;
  const src = req.body.src;
  const width = req.body.width || 640;
  const height = req.body.height || 320;
  const scale = req.body.scale || 1;

  if (!url && !src) {
    return res.status(400).send('Invalid request');
  }

  // Load page
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  if (url) {
    await page.goto(url, { waitUntil: 'networkidle2' });
  } else {
    await page.setContent(src, { waitUntil: 'networkidle2' });
  }

  // Make screenshot
  const screenshot = await page.screenshot({
    type: 'png',
    omitBackground: false
  });
  res.set('Content-Type', 'image/png');
  res.send(screenshot);
};
