import { IDs } from '../../openland-module-api/IDs';
import * as URL from 'url';
import { CacheRepository } from 'openland-module-cache/CacheRepository';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { fetchURLInfo } from './UrlInfo';
import { FileInfo } from 'openland-module-media/FileInfo';
import { ImageRef } from 'openland-module-media/ImageRef';
import { Context, createEmptyContext } from 'openland-utils/Context';
import { UserProfile } from 'openland-module-db/schema';
import { MessageKeyboard } from '../MessageInput';
import { inTx } from '../../foundation-orm/inTx';

export interface URLAugmentation {
    url: string;
    title: string | null;
    subtitle: string | null;
    description: string | null;
    imageInfo: FileInfo | null;
    photo: ImageRef | null;
    iconRef: ImageRef | null;
    iconInfo: FileInfo | null;
    hostname: string | null;
    keyboard?: MessageKeyboard;
    dynamic?: boolean;

    //
    // deprecated
    //
    imageURL: string | null;
    type: 'org' | 'listing' | 'user' | 'url' | 'none' | 'channel' | 'intro';
    extra?: any;
    deleted?: boolean;
}

export class UrlInfoService {
    private specialUrls: { regexp: RegExp, cache: boolean, handler: (url: string, data: any[]) => Promise<URLAugmentation | null> }[] = [];

    private cache = new CacheRepository<URLAugmentation>('url_info');

    public async fetchURLInfo(url: string, useCached: boolean = true): Promise<URLAugmentation> {
        let ctx = createEmptyContext();
        let existing = await this.cache.read(ctx, url);
        let creationTime = await this.cache.getCreationTime(ctx, url);

        if (useCached && existing && (creationTime! + 1000 * 60 * 60 * 24 * 7) >= Date.now()) {
            return existing;
        }

        for (let specialUrl of this.specialUrls) {
            if (specialUrl.regexp.test(url)) {
                let info = await specialUrl.handler(url, specialUrl.regexp.exec(url)!);
                if (info) {
                    if (specialUrl.cache) {
                        await this.cache.write(ctx, url, info);
                    }
                    return info;
                }
            }
        }

        try {
            let info = await fetchURLInfo(url);

            await this.cache.write(ctx, url, {
                ...info,
                type: 'url',
            });

            return {
                ...info,
                type: 'url',
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
                type: 'none',
            };
        }
    }

    public async deleteURLInfoCache(url: string): Promise<boolean> {
        let ctx = createEmptyContext();
        await this.cache.delete(ctx, url);
        return true;
    }

    public async deleteURLInfoCacheAll(parent: Context): Promise<boolean> {
        return inTx(parent, async ctx => {
            await this.cache.deleteAll(ctx);
            return true;
        });
    }

    public specialUrl(regexp: RegExp, cache: boolean, handler: (url: string, data: any[]) => Promise<URLAugmentation | null>) {
        this.specialUrls.push({ regexp, cache, handler });
        return this;
    }
}

const getURLAugmentationForUser = async ({ hostname, url, userId, user }: { hostname?: string; url: string; userId: number; user: UserProfile | null; }) => {
    let org = user!.primaryOrganization && await FDB.OrganizationProfile.findById(createEmptyContext(), user!.primaryOrganization!);
    return {
        url,
        title: user!.firstName + ' ' + user!.lastName,
        subtitle: org ? org.name : null,
        description: user!.about || null,
        imageURL: null,
        imageInfo: user!.picture ? await Modules.Media.fetchFileInfo(createEmptyContext(), user!.picture.uuid) : null,
        photo: user!.picture,
        hostname: null,
        type: 'user',
        extra: userId,
        iconRef: null,
        iconInfo: null,
    } as URLAugmentation;
};

export function createUrlInfoService() {
    let service = new UrlInfoService();

    service
        .specialUrl(/(localhost:3000|(app.|next.)?openland.com)\/(mail|directory)\/u\/(.*)/, false, async (url, data) => {
            let [, , , , _userId] = data;
            let { hostname } = URL.parse(url);

            let userId = IDs.User.parse(_userId);

            let user = await Modules.Users.profileById(createEmptyContext(), userId);

            return await getURLAugmentationForUser({ hostname, url, userId, user });
        })
        .specialUrl(/(localhost:3000|(app.|next.)?openland.com)\/(directory\/)?o\/(.*)/, false, async (url, data) => {
            let [, , , , _orgId] = data;

            let orgId = IDs.Organization.parse(_orgId);

            let ctx = createEmptyContext();
            let org = await FDB.OrganizationProfile.findById(ctx, orgId);
            let membersCount = (await Modules.Orgs.findOrganizationMembers(ctx, org!.id)).length;

            return {
                url,
                title: org!.name || null,
                subtitle: `${membersCount} ${membersCount === 1 ? 'member' : 'members'}`,
                description: org!.about || null,
                imageURL: null,
                imageInfo: org!.photo ? await Modules.Media.fetchFileInfo(createEmptyContext(), org!.photo!.uuid) : null,
                photo: org!.photo || null,
                hostname: null,
                type: 'org',
                extra: orgId,
                iconRef: null,
                iconInfo: null,
            };
        })
        .specialUrl(/(localhost:3000|(app.|next.)?openland.com)\/((mail|directory)\/)(p\/)?(.*)/, false, async (url, data) => {
            let [, , , , , , _channelId] = data;

            let channelId = IDs.Conversation.parse(_channelId);

            let channel = await FDB.ConversationRoom.findById(createEmptyContext(), channelId);

            if (!channel || channel!.kind !== 'public') {
                return null;
            }

            let profile = await FDB.RoomProfile.findById(createEmptyContext(), channelId);

            return {
                url,
                title: profile!.title || null,
                subtitle: profile!.title || null,
                description: profile!.description || null,
                imageURL: null,
                imageInfo: profile!.image ? await Modules.Media.fetchFileInfo(createEmptyContext(), profile!.image.uuid) : null,
                photo: profile!.image,
                hostname: null,
                type: 'channel',
                extra: channelId,
                iconRef: null,
                iconInfo: null,
            };
        })
        .specialUrl(/(localhost:3000|(app.|next.)?openland.com)\/joinChannel\/(.*)/, false, async (url, data) => {
            let ctx = createEmptyContext();
            let [, , , _invite] = data;

            let chatInvite = await Modules.Invites.resolveInvite(ctx, _invite);

            if (!chatInvite || !chatInvite.enabled) {
                return null;
            }

            let profile = await FDB.RoomProfile.findById(ctx, chatInvite.channelId);
            let conv = await FDB.ConversationRoom.findById(ctx, chatInvite.channelId);

            if (!profile) {
                return null;
            }
            let membersCount = await Modules.Messaging.roomMembersCount(ctx, profile.id);

            return {
                url,
                title: profile!.title || null,
                subtitle: membersCount < 10 ? `New ${conv && conv.isChannel ? 'channel' : 'group'}` : (membersCount + ' members'),
                description: profile!.description || null,
                imageURL: null,
                imageInfo: profile!.image ? await Modules.Media.fetchFileInfo(createEmptyContext(), profile!.image.uuid) : null,
                photo: profile!.image,
                hostname: null,
                type: 'url',
                iconRef: null,
                iconInfo: null,
                keyboard: {
                    buttons: [[
                        { title: 'Accept invite', style: 'DEFAULT', url }
                    ]]
                },
                dynamic: true
            };
        })
        .specialUrl(/(localhost:3000|(app.|next.)?openland.com)\/(.*)/, false, async (url, data) => {
            let [, , , _shortname] = data;

            let { hostname } = URL.parse(url);

            let shortname = await Modules.Shortnames.findShortname(createEmptyContext(), _shortname);

            if (!shortname) {
                return null;
            }

            if (shortname.ownerType === 'user') {
                const userId = shortname.ownerId;

                let user = await Modules.Users.profileById(createEmptyContext(), shortname.ownerId);

                return await getURLAugmentationForUser({ hostname, url, userId, user });
            } else if (shortname.ownerType === 'org') {
                let orgId = shortname.ownerId;

                let ctx = createEmptyContext();
                let org = await FDB.OrganizationProfile.findById(ctx, orgId);
                let membersCount = (await Modules.Orgs.findOrganizationMembers(ctx, org!.id)).length;

                return {
                    url,
                    title: org!.name || null,
                    subtitle: `${membersCount} ${membersCount === 1 ? 'member' : 'members'}`,
                    description: org!.about || null,
                    imageURL: null,
                    imageInfo: org!.photo ? await Modules.Media.fetchFileInfo(createEmptyContext(), org!.photo!.uuid) : null,
                    photo: org!.photo || null,
                    hostname: null,
                    type: 'org',
                    extra: orgId,
                    iconRef: null,
                    iconInfo: null,
                };
            } else {
                return null;
            }
        });

    return service;
}
