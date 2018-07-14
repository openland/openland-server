import fetch from 'node-fetch';
import cheerio from 'cheerio';

export interface URLInfo {
    url: string;
    title: string|null;
    description: string|null;
    imageURL: string|null;
}

export async function fetchURLInfo(url: string): Promise<URLInfo> {

    let res = await fetch(url, {
        timeout: 5000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; openlandShare;)'
        }
    });

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

    return {
        url,
        title,
        description,
        imageURL
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