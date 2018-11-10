import fetch from 'node-fetch';
import cheerio from 'cheerio';
import * as URL from 'url';
import { Modules } from 'openland-modules/Modules';
import { FileInfo } from 'openland-module-media/FileInfo';
import { ImageRef } from 'openland-module-media/ImageRef';

export interface URLInfo {
    url: string;
    title: string | null;
    subtitle: string | null;
    description: string | null;
    imageURL: string | null;
    imageInfo: FileInfo | null;
    photo: ImageRef | null;
    hostname: string | null;
    iconRef: ImageRef | null;
    iconInfo: FileInfo | null;
}

export async function fetchURLInfo(url: string): Promise<URLInfo> {

    let res = await fetch(url, {
        timeout: 5000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; openlandShare;)'
        }
    });

    if (res.status !== 200) {
        return {
            url,
            title: null,
            subtitle: null,
            description: null,
            imageURL: null,
            imageInfo: null,
            photo: null,
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
        getHTMLTitle(doc) ||
        null;

    let description =
        getMeta(doc, 'og:description') ||
        getMeta(doc, 'vk:description') ||
        getMeta(doc, 'twitter:description') ||
        null;

    let imageURL =
        getMeta(doc, 'og:image') ||
        getMeta(doc, 'vk:image') ||
        getMeta(doc, 'twitter:image') ||
        null;

    let { hostname, protocol } = URL.parse(url);

    let imageInfo: FileInfo | null = null;
    let imageRef: ImageRef | null = null;

    if (imageURL) {
        try {
            let { file } = await Modules.Media.uploadFromUrl(imageURL);
            imageRef = { uuid: file, crop: undefined };
            imageInfo = await Modules.Media.fetchFileInfo(file);
        } catch (e) {
            console.warn('Cant fetch image ' + imageURL);
        }
    }

    let iconUrl =
        getLink(doc, 'shortcut icon') ||
        getLink(doc, 'icon') ||
        '/favicon.ico';

    if (!URL.parse(iconUrl).hostname) {
        iconUrl = protocol! + '//' + hostname + iconUrl;
    }

    let iconInfo: FileInfo | null = null;
    let iconRef: ImageRef | null = null;

    try {
        let { file } = await Modules.Media.uploadFromUrl(iconUrl);
        iconRef = { uuid: file, crop: undefined };
        iconInfo = await Modules.Media.fetchFileInfo(file);
    } catch (e) {
        console.warn('Cant fetch image ' + imageURL);
    }

    return {
        url,
        title,
        subtitle: null,
        description,
        imageURL,
        imageInfo,
        photo: imageRef,
        hostname: hostname || null,
        iconRef,
        iconInfo
    };
}

function getMeta(doc: CheerioStatic, metaName: string): string | null {
    let data = doc(`meta[property="${metaName}"]`);

    return data[0] ? data[0].attribs.content : null;
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