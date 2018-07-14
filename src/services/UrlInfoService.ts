import { CacheRepository } from '../repositories/CacheRepository';
import { fetchURLInfo, URLInfo } from '../modules/UrlInfo';

export default class UrlInfoService {
    private cache = new CacheRepository<URLInfo>('url_info');

    public async fetchURLInfo(url: string): Promise<URLInfo> {
        let existing = await this.cache.read(url);

        if (existing) {
            return existing;
        }

        try {
            let info = await fetchURLInfo(url);

            await this.cache.write(url, info);

            return info;
        } catch (e) {
            console.warn(e);

            return {
                url,
                title: null,
                description: null,
                imageURL: null
            };
        }
    }
}