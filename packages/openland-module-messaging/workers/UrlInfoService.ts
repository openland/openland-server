import { IDs } from '../../openland-module-api/IDs';
import * as URL from 'url';
import { CacheRepository } from 'openland-module-cache/CacheRepository';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { fetchURLInfo } from './UrlInfo';
import { FileInfo } from 'openland-module-media/FileInfo';
import { ImageRef } from 'openland-module-media/ImageRef';
import { UserProfile } from 'openland-module-db/schema';
import { MessageKeyboard } from '../MessageInput';
import { inTx } from '../../foundation-orm/inTx';
import { EmptyContext, Context } from '@openland/context';

export interface URLAugmentation {
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
    dynamic?: boolean;
    internal?: boolean;
}

export class UrlInfoService {
    private specialUrls: { regexp: RegExp, cache: boolean, handler: (url: string, data: any[]) => Promise<URLAugmentation | null> }[] = [];

    private cache = new CacheRepository<URLAugmentation>('url_info');

    public async fetchURLInfo(url: string, useCached: boolean = true): Promise<URLAugmentation|null> {
        let ctx = EmptyContext;
        let existing = await this.cache.read(ctx, url);
        let creationTime = await this.cache.getCreationTime(ctx, url);

        if (useCached && existing && (creationTime! + 1000 * 60 * 60 * 24 * 7) >= Date.now()) {
            return existing;
        }

        for (let specialUrl of this.specialUrls) {
            if (specialUrl.regexp.test(url)) {
                let info = await specialUrl.handler(url, specialUrl.regexp.exec(url)!);
                if (info) {
                    info = { ...info, internal: true };
                    if (specialUrl.cache) {
                        await this.cache.write(ctx, url, info);
                    }
                    return info;
                }
            }
        }

        try {
            let info = await fetchURLInfo(url);

            if (!info) {
                return null;
            }

            await this.cache.write(ctx, url, { ...info });

            return { ...info };
        } catch (e) {
            return null;
        }
    }

    public async deleteURLInfoCache(url: string): Promise<boolean> {
        let ctx = EmptyContext;
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
    let org = user!.primaryOrganization && await FDB.OrganizationProfile.findById(EmptyContext, user!.primaryOrganization!);

    return {
        url,
        title: user!.firstName + ' ' + user!.lastName,
        subtitle: org ? org.name : null,
        description: user!.about || null,
        imageInfo: user!.picture ? await Modules.Media.fetchFileInfo(EmptyContext, user!.picture.uuid) : null,
        photo: user!.picture,
        hostname: null,
        iconRef: null,
        iconInfo: null,
        keyboard: {
            buttons: [[
                { title: 'Message', style: 'DEFAULT', url: `https://openland.com/mail/${IDs.User.serialize(userId)}` },
                { title: 'View profile', style: 'DEFAULT', url },
            ]]
        }
    } as URLAugmentation;
};

export function createUrlInfoService() {
    let service = new UrlInfoService();

    service
        .specialUrl(/(localhost:3000|(app.|next.|)openland.com)\/(mail|directory)\/u\/(.*)/, false, async (url, data) => {
            let [, , , , _userId] = data;
            let { hostname } = URL.parse(url);

            let userId = IDs.User.parse(_userId);

            let user = await Modules.Users.profileById(EmptyContext, userId);

            return await getURLAugmentationForUser({ hostname, url, userId, user });
        })
        .specialUrl(/(localhost:3000|(app.|next.|)openland.com)\/(directory\/)?(o|c)\/(.*)/, false, async (url, data) => {
            let [, , , , , _orgId] = data;

            let orgId = IDs.Organization.parse(_orgId);

            let ctx = EmptyContext;
            let org = await FDB.OrganizationProfile.findById(ctx, orgId);
            let membersCount = (await Modules.Orgs.findOrganizationMembers(ctx, org!.id)).length;

            return {
                url,
                title: org!.name || null,
                subtitle: `${membersCount} ${membersCount === 1 ? 'member' : 'members'}`,
                description: org!.about || null,
                imageInfo: org!.photo ? await Modules.Media.fetchFileInfo(EmptyContext, org!.photo!.uuid) : null,
                photo: org!.photo || null,
                hostname: null,
                iconRef: null,
                iconInfo: null,
            };
        })
        .specialUrl(/(localhost:3000|(app.|next.|)openland.com)\/((mail|directory)\/)(p\/)?(.*)/, false, async (url, data) => {
            let [, , , , , , _channelId] = data;

            let ctx = EmptyContext;
            let channelId = IDs.Conversation.parse(_channelId);

            let channel = await FDB.ConversationRoom.findById(EmptyContext, channelId);

            if (!channel || channel!.kind !== 'public' || (channel.oid && (await FDB.Organization.findById(ctx, channel.oid))!.kind !== 'community')) {
                return null;
            }

            let profile = await FDB.RoomProfile.findById(EmptyContext, channelId);
            if (!profile) {
                return null;
            }
            let membersCount = profile.activeMembersCount || 0;

            return {
                url,
                title: profile!.title || null,
                subtitle: membersCount < 10 ? `New ${channel && channel.isChannel ? 'channel' : 'group'}` : (membersCount + ' members'),
                description: profile!.description || null,
                imageInfo: profile!.image ? await Modules.Media.fetchFileInfo(EmptyContext, profile!.image.uuid) : null,
                photo: profile!.image,
                hostname: null,
                iconRef: null,
                iconInfo: null,
            };
        })
        .specialUrl(/(localhost:3000|(app.|next.|)openland.com)\/(joinChannel|invite)\/(.*)/, false, async (url, data) => {
            let ctx = EmptyContext;
            let [, , , , _invite] = data;

            let chatInvite = await Modules.Invites.resolveInvite(ctx, _invite);

            if (!chatInvite || !chatInvite.enabled) {
                return null;
            }

            let profile = await FDB.RoomProfile.findById(ctx, chatInvite.channelId);
            let conv = await FDB.ConversationRoom.findById(ctx, chatInvite.channelId);

            if (!profile) {
                return null;
            }
            let membersCount = profile.activeMembersCount || 0;

            return {
                url,
                title: profile!.title || null,
                subtitle: membersCount < 10 ? `New ${conv && conv.isChannel ? 'channel' : 'group'}` : (membersCount + ' members'),
                description: profile!.description || null,
                imageInfo: profile!.image ? await Modules.Media.fetchFileInfo(EmptyContext, profile!.image.uuid) : null,
                photo: profile!.image,
                hostname: null,
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
        .specialUrl(/(localhost:3000|(app.|next.|)openland.com)\/(.*)/, false, async (url, data) => {
            let [, , , _shortname] = data;

            let { hostname } = URL.parse(url);

            let shortname = await Modules.Shortnames.findShortname(EmptyContext, _shortname);

            if (!shortname) {
                return null;
            }

            if (shortname.ownerType === 'user') {
                const userId = shortname.ownerId;

                let user = await Modules.Users.profileById(EmptyContext, shortname.ownerId);

                return await getURLAugmentationForUser({ hostname, url, userId, user });
            } else if (shortname.ownerType === 'org') {
                let orgId = shortname.ownerId;

                let ctx = EmptyContext;
                let org = await FDB.OrganizationProfile.findById(ctx, orgId);
                let membersCount = (await Modules.Orgs.findOrganizationMembers(ctx, org!.id)).length;

                return {
                    url,
                    title: org!.name || null,
                    subtitle: `${membersCount} ${membersCount === 1 ? 'member' : 'members'}`,
                    description: org!.about || null,
                    imageInfo: org!.photo ? await Modules.Media.fetchFileInfo(EmptyContext, org!.photo!.uuid) : null,
                    photo: org!.photo || null,
                    hostname: null,
                    iconRef: null,
                    iconInfo: null,
                };
            } else {
                return null;
            }
        });

    return service;
}
