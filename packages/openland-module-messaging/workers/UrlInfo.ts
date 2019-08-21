import fetch from 'node-fetch';
import cheerio from 'cheerio';
import * as URL from 'url';
import { Modules } from 'openland-modules/Modules';
import { FileInfo } from 'openland-module-media/FileInfo';
import { ImageRef } from 'openland-module-media/ImageRef';
import { MessageKeyboard } from 'openland-module-messaging/MessageInput';
import { URLAugmentation } from './UrlInfoService';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';

export interface URLInfo {
    url: string;
    title: string | null;
    subtitle: string | null;
    description: string | null;
    photo: ImageRef | null;
    photoPreview: string | null;
    imageInfo: FileInfo | null;
    iconRef: ImageRef | null;
    iconInfo: FileInfo | null;
    hostname: string | null;
    keyboard?: MessageKeyboard;
}

type RawURLInfo = { url: string, title?: string | null, description?: string | null, imageURL?: string | null, iconURL?: string | null };

const FetchParams = {
    timeout: 5000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Safari/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-us'
    },
};

class URLInfoFetcher {
    private specialUrls: { condition: (url: string, hostname: string) => boolean, handler: (url: string) => Promise<URLInfo | null | boolean> }[] = [];

    public async fetchURLInfo(url: string): Promise<URLInfo | null> {
        let { hostname } = URL.parse(url);

        for (let specialUrl of this.specialUrls) {
            if (specialUrl.condition(url, hostname || '')) {
                let info = await specialUrl.handler(url);
                if (typeof info === 'boolean') {
                    if (!info) {
                        return null;
                    }
                } else {
                    if (info) {
                        return info;
                    }
                }
            }
        }

        try {
            let raw = await fetchRawURLInfo(url);
            if (raw) {
                return await fetchImages(raw.info);
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    public specialUrl(condition: (url: string, hostname: string) => boolean, handler: (url: string) => Promise<URLAugmentation | null | boolean>) {
        this.specialUrls.push({ condition, handler });
        return this;
    }
}

export const fetchURLInfo = createURLInfoFetcher();

function createURLInfoFetcher() {
    let fetcher = new URLInfoFetcher();

    fetcher
        .specialUrl((_, hostname) => hostname.endsWith('linkedin.com'), async () => false)
        .specialUrl((_, hostname) => hostname.endsWith('notion.so'), async () => false)
        .specialUrl((_, hostname) => hostname.endsWith('wikipedia.org'), async (url) => {
            let raw = await fetchRawURLInfo(url);
            if (raw && raw.doc) {
                return await fetchImages({
                    ...raw.info,
                    description: raw.doc('p', '.mw-parser-output').first().text()
                });
            }
            return null;
        })
        .specialUrl((url, hostname) => (hostname.endsWith('youtube.com') && url.includes('watch?v=')) || hostname.endsWith('youtu.be') , async (url) => {
            let res = await fetch(encodeURI(url), FetchParams);

            if (res.status !== 200) {
                return null;
            }

            let text = await res.text();

            let data = /ytplayer\.config = (\{(.*)\});ytplayer.load =/.exec(text);
            if (!data || !data[1]) {
                return null;
            }

            let jsonData = JSON.parse(data[1]);
            if (!jsonData.args || !jsonData.args.player_response) {
                return null;
            }
            jsonData = JSON.parse(jsonData.args.player_response);

            let videoDetails = jsonData.videoDetails;

            return fetchImages({
                url,
                title: videoDetails.title,
                description: videoDetails.shortDescription,
                imageURL: videoDetails.thumbnail.thumbnails[videoDetails.thumbnail.thumbnails.length - 1].url,
                iconURL: 'https://s.ytimg.com/yts/img/favicon_144-vfliLAfaB.png'
            });
        });

    return (url: string) => fetcher.fetchURLInfo(url);
}

async function fetchRawURLInfo(url: string): Promise<{ info: RawURLInfo, doc?: CheerioStatic } | null> {
    let { hostname } = URL.parse(url);

    let res = await fetch(encodeURI(url), FetchParams);

    if (res.status !== 200) {
        return null;
    }

    let contentType = res.headers.get('content-type');

    if (contentType && contentType.startsWith('image')) {
        return { info: { url, imageURL: url } };
    }

    let text = await res.text();
    let doc = cheerio.load(text);

    let title =
        getMeta(doc, 'og:title') ||
        getMeta(doc, 'vk:title') ||
        getMeta(doc, 'twitter:title') ||
        getMeta(doc, 'title') ||
        getHTMLTitle(doc) ||
        null;

    let description =
        getMeta(doc, 'og:description') ||
        getMeta(doc, 'vk:description') ||
        getMeta(doc, 'twitter:description') ||
        getMeta(doc, 'description') ||
        null;

    if (hostname && hostname.endsWith('wikipedia.org')) {
        description = doc('p', '.mw-parser-output').first().text();
    }

    let imageURL =
        getMeta(doc, 'og:image') ||
        getMeta(doc, 'vk:image') ||
        getMeta(doc, 'twitter:image') ||
        getMeta(doc, 'image') ||
        null;

    let iconURL =
        getLink(doc, 'shortcut icon') ||
        getLink(doc, 'icon') ||
        '/favicon.ico';
    iconURL = URL.resolve(url, iconURL);

    return {
        info: {
            url,
            title,
            description,
            imageURL,
            iconURL
        },
        doc
    };
}

const rootCtx = createNamedContext('url-info');
const logger = createLogger('url-info');

async function fetchImages(params: RawURLInfo | null): Promise<URLInfo | null> {
    if (!params) {
        return null;
    }
    let {
        url,
        title,
        description,
        imageURL,
        iconURL
    } = params;

    let { hostname } = URL.parse(url);

    let imageInfo: FileInfo | null = null;
    let imageRef: ImageRef | null = null;

    if (imageURL) {
        imageURL = URL.resolve(url, imageURL);
        try {
            let { file } = await Modules.Media.uploadFromUrl(rootCtx, imageURL);
            imageRef = { uuid: file, crop: null };
            imageInfo = await Modules.Media.fetchFileInfo(rootCtx, file);
        } catch (e) {
            logger.warn(rootCtx, 'Cant fetch image ' + imageURL);
        }
    }

    let iconInfo: FileInfo | null = null;
    let iconRef: ImageRef | null = null;

    if (iconURL) {
        try {
            let { file } = await Modules.Media.uploadFromUrl(rootCtx, iconURL);
            iconRef = { uuid: file, crop: null };
            iconInfo = await Modules.Media.fetchFileInfo(rootCtx, file);
        } catch (e) {
            logger.warn(rootCtx, 'Cant fetch image ' + iconURL);
        }
    }

    return {
        url,
        title: title || null,
        subtitle: null,
        description: description || null,
        imageInfo: Modules.Media.sanitizeFileInfo(imageInfo),
        photo: imageRef,
        photoPreview: await Modules.Media.fetchLowResPreview(rootCtx, imageRef!.uuid),
        hostname: hostname || null,
        iconRef,
        iconInfo: Modules.Media.sanitizeFileInfo(iconInfo),
    };
}

function getMeta(doc: CheerioStatic, metaName: string): string | null {
    let data = doc(`meta[property="${metaName}"]`);
    let data2 = doc(`meta[name="${metaName}"]`);

    return (data[0] ? data[0].attribs.content : null) || (data2[0] ? data2[0].attribs.content : null);
}

function getHTMLTitle(doc: CheerioStatic): string | null {
    let data = doc('title');

    if (
        data[0] &&
        data[0].children &&
        data[0].children[0] &&
        data[0].children[0].data
    ) {
        return data[0].children[0].data || null;
    }

    return null;
}

function getLink(doc: CheerioStatic, rel: string): string | null {
    let data = doc(`link[rel="${rel}"]`);

    return data[0] ? data[0].attribs.href : null;
}