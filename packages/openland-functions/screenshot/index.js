const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const express = require('express');

let page;

async function getBrowserPage() {
  // Launch headless Chrome. Turn off sandbox so Chrome can run under root.
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: 'google-chrome-unstable',
    headless: true,
  });
  return browser.newPage();
}


class AsyncLock {
  constructor() {
    this.permits = 1;
    this.promiseResolverQueue = [];
  }

  async inLock(func) {
    try {
      await this.lock();
      return await func();
    } finally {
      this.unlock();
    }
  }

  async lock() {
    if (this.permits > 0) {
      this.permits = this.permits - 1;
      return;
    }
    await new Promise(resolve => this.promiseResolverQueue.push(resolve));
  }

  unlock() {
    this.permits += 1;
    if (this.permits > 1 && this.promiseResolverQueue.length > 0) {
      throw new Error('this.permits should never be > 0 when there is someone waiting.');
    } else if (this.permits === 1 && this.promiseResolverQueue.length > 0) {
      // If there is someone else waiting, immediately consume the permit that was released
      // at the beginning of this function and let the waiting function resume.
      this.permits -= 1;

      const nextResolver = this.promiseResolverQueue.shift();
      // Resolve on the next tick
      if (nextResolver) {
        setTimeout(() => {
          nextResolver(true);
        }, 0);
      }
    }
  }
}

const lock = new AsyncLock();

const app = express();
app.use(express.json());

app.post('/', async (req, res) => {
  await lock.inLock(async () => {
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
  });
});


app.post('/html', async (req, res) => {
  await lock.inLock(async () => {
    if (!page) {
      page = await getBrowserPage();
    }

    const url = req.body.url;
    const width = req.body.width || 640;
    const height = req.body.height || 320;
    const scale = req.body.scale || 1;

    if (!url) {
      return res.status(400).send('Invalid request');
    }

    // Load page
    await page.setViewport({ width, height, deviceScaleFactor: scale });
    let response = await page.goto(url, { waitUntil: 'networkidle2' });

    // Capture screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      omitBackground: false,
      encoding: 'base64'
    });

    // load html
    const html = await page.content();
    res.json({
      html,
      screenshot,
      status: response.status()
    });
  });
});


app.listen(8080, () => {
  console.log('Server is listening on 8080');
});