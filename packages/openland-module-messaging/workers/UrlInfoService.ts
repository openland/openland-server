import { IDs } from '../../openland-module-api/IDs';
import * as URL from 'url';
import { CacheRepository } from 'openland-module-cache/CacheRepository';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { fetchURLInfo } from './UrlInfo';
import { FileInfo } from 'openland-module-media/FileInfo';
import { ImageRef } from 'openland-module-media/ImageRef';
import { createEmptyContext } from 'openland-utils/Context';

export interface URLAugmentation {
    url: string;
    title: string | null;
    subtitle: string | null;
    description: string | null;
    imageURL: string | null;
    imageInfo: FileInfo | null;
    photo: ImageRef | null;
    iconRef: ImageRef | null;
    iconInfo: FileInfo | null;
    hostname: string | null;
    type: 'org' | 'listing' | 'user' | 'url' | 'none' | 'channel' | 'intro';
    extra?: any;
    deleted?: boolean;
}

export default class UrlInfoService {
    private userRegexp = /(localhost:3000|(app.)?openland.com)\/(mail|directory)\/u\/(.*)/;
    private orgRegexp = /(localhost:3000|(app.)?openland.com)\/(directory\/)?o\/(.*)/;
    private channelRegexp = /(localhost:3000|(app.)?openland.com)\/mail\/(.*)/;
    private cache = new CacheRepository<URLAugmentation>('url_info');

    public async fetchURLInfo(url: string): Promise<URLAugmentation> {
        let ctx = createEmptyContext();
        let existing = await this.cache.read(ctx, url);
        let creationTime = await this.cache.getCreationTime(ctx, url);

        if (existing && creationTime! < 1000 * 60 * 60 * 24 * 7) {
            return existing;
        }

        if (this.userRegexp.test(url)) {
            let info = await this.parseUserUrl(url);

            await this.cache.write(ctx, url, info);

            return info;
        }

        if (this.orgRegexp.test(url)) {
            let info = await this.parseOrgUrl(url);

            await this.cache.write(ctx, url, info);

            return info;
        }

        if (this.channelRegexp.test(url)) {
            let info = await this.parseChannelUrl(url);

            if (info) {
                await this.cache.write(ctx, url, info);

                return info;
            }
        }

        try {
            let info = await fetchURLInfo(url);

            await this.cache.write(ctx, url, {
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
                imageInfo: null,
                photo: null,
                hostname: null,
                iconRef: null,
                iconInfo: null,
                type: 'none'
            };
        }
    }

    private async parseUserUrl(url: string): Promise<URLAugmentation> {
        let [, , , , _userId] = this.userRegexp.exec(url)!;
        let { hostname } = URL.parse(url);

        let userId = IDs.User.parse(_userId);

        let user = await Modules.Users.profileById(createEmptyContext(), userId);

        return {
            url,
            title: user!.firstName + ' ' + user!.lastName,
            subtitle: user!.about || null,
            description: user!.about || null,
            imageURL: null,
            imageInfo: user!.picture ? await Modules.Media.fetchFileInfo(createEmptyContext(), user!.picture.uuid) : null,
            photo: user!.picture,
            hostname: hostname || null,
            type: 'user',
            extra: userId,
            iconRef: null,
            iconInfo: null,
        };
    }

    private async parseOrgUrl(url: string): Promise<URLAugmentation> {
        let [, , , , _orgId] = this.orgRegexp.exec(url)!;
        let { hostname } = URL.parse(url);

        let orgId = IDs.Organization.parse(_orgId);

        let org = await FDB.OrganizationProfile.findById(createEmptyContext(), orgId);

        return {
            url,
            title: org!.name || null,
            subtitle: (org!.about || null),
            description: (org!.about) || null,
            imageURL: null,
            imageInfo: org!.photo ? await Modules.Media.fetchFileInfo(createEmptyContext(), org!.photo.uuid) : null,
            photo: org!.photo || null,
            hostname: hostname || null,
            type: 'org',
            extra: orgId,
            iconRef: null,
            iconInfo: null,
        };
    }

    private async parseChannelUrl(url: string): Promise<URLAugmentation | null> {
        let [, , , _channelId] = this.channelRegexp.exec(url)!;
        let { hostname } = URL.parse(url);

        let channelId = IDs.Conversation.parse(_channelId);

        let channel = await FDB.ConversationRoom.findById(createEmptyContext(), channelId);

        if (!channel || channel!.kind !== 'public') {
            return null;
        }

        let profile = (await FDB.RoomProfile.findById(createEmptyContext(), channelId));

        return {
            url,
            title: profile!.title || null,
            subtitle: profile!.title || null,
            description: profile!.description || null,
            imageURL: null,
            imageInfo: profile!.image ? await Modules.Media.fetchFileInfo(createEmptyContext(), profile!.image.uuid) : null,
            photo: profile!.image,
            hostname: hostname || null,
            type: 'channel',
            extra: channelId,
            iconRef: null,
            iconInfo: null,
        };
    }
}