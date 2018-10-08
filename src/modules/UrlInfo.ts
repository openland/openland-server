import fetch from 'node-fetch';
import cheerio from 'cheerio';
import { ImageRef } from '../repositories/Media';
import * as URL from 'url';
import { Services } from '../services';
import { UploadCareFileInfo } from '../services/UploadCare';

export interface URLInfo {
    url: string;
    title: string|null;
    subtitle: string|null;
    description: string|null;
    imageURL: string|null;
    imageInfo: UploadCareFileInfo|null;
    photo: ImageRef|null;
    hostname: string|null;
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
        };
    }

    let text = await res.text();
    let doc = cheerio.load(text);

    let title =
        getMeta(doc, 'og:title')  ||
        getMeta(doc, 'vk:title')  ||
        getMeta(doc, 'twitter:title')  ||
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

    let {hostname} = URL.parse(url);

    let imageInfo: UploadCareFileInfo|null = null;
    let imageRef: ImageRef|null = null;

    if (imageURL) {
        try {
            let {file} = await Services.UploadCare.uploadFromUrl(imageURL);
            imageRef = { uuid: file };
            imageInfo = await Services.UploadCare.fetchFileInfo(file);
        } catch (e) {
            console.warn('Cant fetch image ' + imageURL);
        }
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
    };
}

function getMeta(doc: CheerioStatic, metaName: string): string|null {
    let data = doc(`meta[property="${metaName}"]`);

    return data[0] ? data[0].attribs.content : null;
}

function getHTMLTitle(doc: CheerioStatic): string|null {
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