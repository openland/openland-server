import fetch from 'node-fetch';
import cheerio from 'cheerio';
import * as URL from 'url';
import { Modules } from 'openland-modules/Modules';
import { FileInfo } from 'openland-module-media/FileInfo';
import { ImageRef } from 'openland-module-media/ImageRef';
import { createEmptyContext } from 'openland-utils/Context';
import { MessageKeyboard } from 'openland-module-messaging/MessageInput';

export interface URLInfo {
    url: string;
    title: string | null;
    subtitle: string | null;
    description: string | null;
    photo: ImageRef | null;
    imageInfo: FileInfo | null;
    iconRef: ImageRef | null;
    iconInfo: FileInfo | null;
    hostname: string | null;
    keyboard?: MessageKeyboard;
}

export async function fetchURLInfo(url: string): Promise<URLInfo|null> {
    let { hostname } = URL.parse(url);

    if (hostname && hostname.endsWith('linkedin.com')) {
        url = 'https://www.linkedin.com/';
    }

    let res = await fetch(encodeURI(url), {
        timeout: 5000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Safari/605.1.15',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-us'
        },
    });

    if (res.status !== 200) {
        return null;
    }

    let contentType = res.headers.get('content-type');

    if (contentType && contentType.startsWith('image')) {
        let imgInfo: FileInfo | null = null;
        let imgRef: ImageRef | null = null;

        try {
            let { file } = await Modules.Media.uploadFromUrl(createEmptyContext(), url);
            imgRef = { uuid: file, crop: null };
            imgInfo = await Modules.Media.fetchFileInfo(createEmptyContext(), file);
        } catch (e) {
            console.warn('Cant fetch image ' + url);
        }

        return {
            url,
            title: null,
            subtitle: null,
            description: null,
            imageInfo: imgInfo,
            photo: imgRef,
            hostname: null,
            iconRef: null,
            iconInfo: null
        };
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

    let imageInfo: FileInfo | null = null;
    let imageRef: ImageRef | null = null;

    if (imageURL) {
        imageURL = URL.resolve(url, imageURL);
        try {
            let { file } = await Modules.Media.uploadFromUrl(createEmptyContext(), imageURL);
            imageRef = { uuid: file, crop: null };
            imageInfo = await Modules.Media.fetchFileInfo(createEmptyContext(), file);
        } catch (e) {
            console.warn('Cant fetch image ' + imageURL);
        }
    }

    let iconUrl =
        getLink(doc, 'shortcut icon') ||
        getLink(doc, 'icon') ||
        '/favicon.ico';

    iconUrl = URL.resolve(url, iconUrl);

    let iconInfo: FileInfo | null = null;
    let iconRef: ImageRef | null = null;

    try {
        let { file } = await Modules.Media.uploadFromUrl(createEmptyContext(), iconUrl);
        iconRef = { uuid: file, crop: null };
        iconInfo = await Modules.Media.fetchFileInfo(createEmptyContext(), file);
    } catch (e) {
        console.warn('Cant fetch image ' + iconUrl);
    }

    return {
        url,
        title,
        subtitle: null,
        description,
        imageInfo: Modules.Media.sanitizeFileInfo(imageInfo),
        photo: imageRef,
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