import { CacheRepository } from '../repositories/CacheRepository';
import { fetchURLInfo } from '../modules/UrlInfo';
import { IDs } from '../api/utils/IDs';
import { DB } from '../tables';
import * as URL from 'url';
import { ImageRef } from '../repositories/Media';

export interface URLAugmentation {
    url: string;
    title: string|null;
    subtitle: string|null;
    description: string|null;
    imageURL: string|null;
    photo: ImageRef|null;
    hostname: string|null;
    type: 'org' | 'listing' | 'user' | 'url' | 'none' | 'channel' | 'intro';
    extra?: any;
}

export default class UrlInfoService {
    private listingRegexp = /^(http:\/\/localhost:3000|https:\/\/app.openland.com)\/o\/(.*)\/listings\#(.*)/;
    private userRegexp = /^(http:\/\/localhost:3000|https:\/\/app.openland.com)\/mail\/u\/(.*)/;
    private orgRegexp = /^(http:\/\/localhost:3000|https:\/\/app.openland.com)\/(directory\/)?o\/(.*)/;
    private channelRegexp = /^(http:\/\/localhost:3000|https:\/\/app.openland.com)\/mail\/(.*)/;
    private cache = new CacheRepository<URLAugmentation>('url_info');

    public async fetchURLInfo(url: string): Promise<URLAugmentation> {
        let existing = await this.cache.read(url);

        if (existing) {
            return existing;
        }

        if (this.isListingUrl(url)) {
            let info = await this.parseListingUrl(url);

            await this.cache.write(url, info);

            return info;
        }

        if (this.userRegexp.test(url)) {
            let info = await this.parseUserUrl(url);

            await this.cache.write(url, info);

            return info;
        }

        if (this.orgRegexp.test(url)) {
            let info = await this.parseOrgUrl(url);

            await this.cache.write(url, info);

            return info;
        }

        if (this.channelRegexp.test(url)) {
            let info = await this.parseChannelUrl(url);

            if (info) {
                await this.cache.write(url, info);

                return info;
            }
        }

        try {
            let info = await fetchURLInfo(url);

            await this.cache.write(url, {
                ...info,
                type: 'url'
            });

            return {
                ...info,
                type: 'url'
            };
        } catch (e) {
            return {
                url,
                title: null,
                subtitle: null,
                description: null,
                imageURL: null,
                photo: null,
                hostname: null,
                type: 'none'
            };
        }
    }

    private isListingUrl(url: string): boolean {
        return this.listingRegexp.test(url);
    }

    private async parseListingUrl(url: string): Promise<URLAugmentation> {
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
            hostname: hostname || null,
            type: 'listing',
            extra: listing!.id
        };
    }

    private async parseUserUrl(url: string): Promise<URLAugmentation> {
        let [, , _userId] = this.userRegexp.exec(url)!;
        let {hostname} = URL.parse(url);

        let userId = IDs.User.parse(_userId);

        let user = await DB.UserProfile.find({ where: {userId }});

        return {
            url,
            title: user!.firstName + ' ' + user!.lastName,
            subtitle: user!.about || null,
            description: user!.about || null,
            imageURL: null,
            photo: user!.picture,
            hostname: hostname || null,
            type: 'user',
            extra: userId
        };
    }

    private async parseOrgUrl(url: string): Promise<URLAugmentation> {
        let [, , , _orgId] = this.orgRegexp.exec(url)!;
        let {hostname} = URL.parse(url);

        let orgId = IDs.Organization.parse(_orgId);

        let org = await DB.Organization.findById(orgId);

        return {
            url,
            title: org!.name || null,
            subtitle: (org!.extras && org!.extras!.about) || null,
            description: (org!.extras && org!.extras!.about) || null,
            imageURL: null,
            photo: org!.photo || null,
            hostname: hostname || null,
            type: 'org',
            extra: orgId
        };
    }

    private async parseChannelUrl(url: string): Promise<URLAugmentation|null> {
        let [, , _channelId] = this.channelRegexp.exec(url)!;
        let {hostname} = URL.parse(url);

        let channelId = IDs.Conversation.parse(_channelId);

        let channel = await DB.Conversation.findById(channelId);

        if (channel!.type !== 'channel') {
            return null;
        }

        return {
            url,
            title: channel!.title || null,
            subtitle: channel!.title || null,
            description: channel!.title || null,
            imageURL: null,
            photo: channel!.extras!.picture as any || null,
            hostname: hostname || null,
            type: 'channel',
            extra: channelId
        };
    }
}