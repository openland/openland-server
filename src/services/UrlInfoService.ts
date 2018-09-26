import { CacheRepository } from '../repositories/CacheRepository';
import { fetchURLInfo, URLInfo } from '../modules/UrlInfo';
import { IDs } from '../api/utils/IDs';
import { DB } from '../tables';
import * as URL from 'url';


export default class UrlInfoService {
    private listingRegexp = /^(http:\/\/localhost:3000|https:\/\/app.openland.com)\/o\/(.*)\/listings\#(.*)/;
    private cache = new CacheRepository<URLInfo>('url_info');

    public async fetchURLInfo(url: string): Promise<URLInfo> {
        let existing = await this.cache.read(url);

        if (existing) {
            return existing;
        }

        if (this.isListingUrl(url)) {
            let info = await this.parseListingUrl(url);

            await this.cache.write(url, info);

            return info;
        }

        try {
            let info = await fetchURLInfo(url);

            await this.cache.write(url, info);

            return info;
        } catch (e) {
            return {
                url,
                title: null,
                subtitle: null,
                description: null,
                imageURL: null,
                photo: null,
                hostname: null
            };
        }
    }

    private isListingUrl(url: string): boolean {
        return this.listingRegexp.test(url);
    }

    private async parseListingUrl(url: string): Promise<URLInfo> {
        let [, , _orgId, _listingId] = this.listingRegexp.exec(url)!;
        let {hostname} = URL.parse(url);

        let orgId = IDs.Organization.parse(_orgId);
        let listingId = IDs.OrganizationListing.parse(_listingId);

        let org = await DB.Organization.findById(orgId);
        let listing = await DB.OrganizationListing.findById(listingId);

        return {
            url,
            title: org!.name || null,
            subtitle: listing!.name || null,
            description: listing!.extras!.summary || null,
            imageURL: null,
            photo: listing!.extras!.photo || null,
            hostname: hostname || null
        };
    }
}