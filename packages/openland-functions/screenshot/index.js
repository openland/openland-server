const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require("form-data");

const UPLOAD_CARE_PUB_KEY = 'b70227616b5eac21ba88';
const UPLOAD_CARE_AUTH = 'Uploadcare.Simple b70227616b5eac21ba88:65d4918fb06d4fe0bec8';

class UploadCareLoader {
    async fetchFileInfo(uuid) {
        let res = await this.call('files/' + uuid + '/');

        let isImage = !!(res.is_image || res.image_info);
        let imageWidth = isImage ? res.image_info.width : null;
        let imageHeight = isImage ? res.image_info.height : null;
        let imageFormat = isImage ? res.image_info.format : null;
        let mimeType = res.mime_type;
        let name = res.original_filename;
        let size = res.size;
        let isReady = !!(res.is_ready);

        return {
            isStored: isReady,
            isImage,
            imageWidth,
            imageHeight,
            imageFormat,
            mimeType,
            name,
            size
        };
    }

    async saveFile(uuid) {
        let fileInfo = await this.fetchFileInfo(uuid);

        if (!fileInfo.isStored) {
            await this.call('files/' + uuid + '/storage', 'PUT');
            fileInfo.isStored = true;
        }

        return fileInfo;
    }

    async upload(imgData, fileName) {
        let form = new FormData();
        form.append('UPLOADCARE_STORE', '1');
        form.append('UPLOADCARE_PUB_KEY', UPLOAD_CARE_PUB_KEY);
        form.append('file', imgData, {filename: fileName});

        let res = await fetch(
            'https://upload.uploadcare.com/base/',
            {method: 'POST', body: form}
        );
        return res.json();
    }

    async call(path, method = 'GET') {
        let res = await fetch('https://api.uploadcare.com/' + path, {
            method,
            headers: {
                'Authorization': UPLOAD_CARE_AUTH
            }
        });
        return res.json();
    }
}

let cachedBrowser;
let cachedEndpoint;

async function getBrowser() {
    if (cachedBrowser && cachedBrowser.isConnected()) {
        return cachedBrowser;
    }

    // Launch headless Chrome. Turn off sandbox so Chrome can run under root.
    cachedBrowser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: 'google-chrome-unstable',
        headless: true,
    });
    cachedBrowser.on('disconnected', () => {
        cachedBrowser = null;
    })

    return cachedBrowser;
}

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
const ucare = new UploadCareLoader();

const app = express();
app.use(express.json());

function handleAsync(callback) {
    return function (req, res, next) {
        callback(req, res, next)
            .catch(next)
    }
}

app.post('/', handleAsync(async (req, res) => {
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
        await page.setViewport({width, height, deviceScaleFactor: scale});
        if (url) {
            await page.goto(url, {waitUntil: 'networkidle2'});
        } else {
            await page.setContent(src, {waitUntil: 'networkidle2'});
        }

        // Make screenshot
        const screenshot = await page.screenshot({
            type: 'png',
            omitBackground: false
        });
        res.set('Content-Type', 'image/png');
        res.send(screenshot);
    });
}));

app.post('/html', handleAsync(async (req, res) => {
    await lock.inLock(async () => {
        let browser = await getBrowser();
        let page = await browser.newPage();

        const url = req.body.url;
        const width = req.body.width || 640;
        const height = req.body.height || 320;
        const scale = req.body.scale || 1;

        if (!url) {
            return res.status(400).send('Invalid request');
        }

        // Load page
        await page.setViewport({width, height, deviceScaleFactor: scale});
        let response = await page.goto(url, {waitUntil: 'networkidle2'});

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
        await page.close();
    });
}));

app.post('/render', handleAsync(async (req, res) => {
    const templates = require('./templates/index.json');
    const appDir = path.dirname(require.main.filename);

    await lock.inLock(async () => {
        if (!page) {
            page = await getBrowserPage();
        }

        const args = req.body.args;
        const templateName = req.body.template;
        if (!args || !templateName) {
            return res.status(400).send('Invalid request');
        }
        if (!templates[templateName]) {
            return res.status(400).send('Invalid template');
        }

        let template = templates[templateName];
        const {
            width,
            height,
            file
        } = template;

        // Load page
        await page.setViewport({width, height, deviceScaleFactor: 2});
        await page.goto(`file://${path.join(appDir, 'templates', file)}`, {waitUntil: 'networkidle2'});

        // Fill template
        await page.evaluate((a) => fill(a), args)

        // Make screenshot
        const screenshot = await page.screenshot({
            type: 'png',
            omitBackground: false
        });
        let ucareFile = await ucare.upload(screenshot, 'sharing@2x.png');
        await ucare.saveFile(ucareFile.file);
        res.json({
            file: ucareFile.file
        });
    });
}));

app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.status(500).json({
        error: err.toString(),
    });
});

app.listen(8080, () => {
    console.log('Server is listening on 8080');
});