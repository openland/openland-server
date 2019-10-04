import { inTx, withReadOnlyTransaction } from '@openland/foundationdb';
import { IDs, IdsFactory } from '../../openland-module-api/IDs';
import * as URL from 'url';
import { CacheRepository } from 'openland-module-cache/CacheRepository';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { fetchURLInfo } from './UrlInfo';
import { FileInfo } from 'openland-module-media/FileInfo';
import { ImageRef } from 'openland-module-media/ImageRef';
import { MessageKeyboard } from '../MessageInput';
import { Context, createNamedContext } from '@openland/context';
import { UserProfile } from 'openland-module-db/store';
import { doSimpleHash } from '../../openland-module-push/workers/PushWorker';

export const makePhotoFallback = (id: string, text: string) => ({ photo: 'ph://' + doSimpleHash(id) % 6, text });

const rootCtx = createNamedContext('url-info');

export interface URLAugmentation {
    url: string;
    title: string | null;
    subtitle: string | null;
    description: string | null;
    photo: ImageRef | null;
    photoPreview: string | null;
    imageInfo: FileInfo | null;
    photoFallback?: { photo: string, text: string } | null;
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

    public async fetchURLInfo(url: string, useCached: boolean = true): Promise<URLAugmentation | null> {
        let ctx = rootCtx;
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
        let ctx = rootCtx;
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
    let org = user!.primaryOrganization && await Store.OrganizationProfile.findById(withReadOnlyTransaction(rootCtx), user!.primaryOrganization!);

    return {
        url,
        title: user!.firstName + ' ' + user!.lastName,
        subtitle: org ? org.name : null,
        description: user!.about || null,
        imageInfo: user!.picture ? await Modules.Media.fetchFileInfo(rootCtx, user!.picture.uuid) : null,
        photo: user!.picture,
        hostname: null,
        photoPreview: user!.picture ? await Modules.Media.fetchLowResPreview(rootCtx, user!.picture.uuid) : null,
        iconRef: null,
        iconInfo: null,
        keyboard: {
            buttons: [[
                { title: 'Message', style: 'DEFAULT', url: `https://openland.com/mail/${IDs.User.serialize(userId)}` },
                // { title: 'View profile', style: 'DEFAULT', url },
            ]]
        },
        photoFallback: makePhotoFallback(IDs.User.serialize(user!.id), user!.firstName + ' ' + user!.lastName),
    } as URLAugmentation;
};

export function createUrlInfoService() {
    let service = new UrlInfoService();

    service
        // .specialUrl(/(localhost:3000|(app.|next.|)openland.com)\/(mail|directory)\/u\/(.*)/, false, async (url, data) => {
        //     let [, , , , _userId] = data;
        //     let { hostname } = URL.parse(url);
        //
        //     let userId = IDs.User.parse(_userId);
        //
        //     let user = await Modules.Users.profileById(rootCtx, userId);
        //
        //     return await getURLAugmentationForUser({ hostname, url, userId, user });
        // })
        // .specialUrl(/(localhost:3000|(app.|next.|)openland.com)\/(directory\/)?(o|c)\/(.*)/, false, async (url, data) => {
        //     let [, , , , , _orgId] = data;
        //
        //     let orgId = IDs.Organization.parse(_orgId);
        //
        //     let ctx = withReadOnlyTransaction(rootCtx);
        //     let org = await Store.OrganizationProfile.findById(ctx, orgId);
        //     let membersCount = (await Modules.Orgs.findOrganizationMembers(ctx, org!.id)).length;
        //
        //     return {
        //         url,
        //         title: org!.name || null,
        //         subtitle: `${membersCount} ${membersCount === 1 ? 'member' : 'members'}`,
        //         description: org!.about || null,
        //         imageInfo: org!.photo ? await Modules.Media.fetchFileInfo(rootCtx, org!.photo!.uuid) : null,
        //         photo: org!.photo || null,
        //         photoPreview: org!.photo ? await Modules.Media.fetchLowResPreview(ctx, org!.photo.uuid) : null,
        //         hostname: null,
        //         iconRef: null,
        //         iconInfo: null,
        //         photoFallback: makePhotoFallback(IDs.Organization.serialize(org!.id), org!.name || 'deleted'),
        //     };
        // })
        // .specialUrl(/(localhost:3000|(app.|next.|)openland.com)\/((mail|directory)\/)(p\/)?(.*)/, false, async (url, data) => {
        //     let [, , , , , , _channelId] = data;
        //
        //     let ctx = withReadOnlyTransaction(rootCtx);
        //     let channelId = IDs.Conversation.parse(_channelId);
        //
        //     let channel = await Store.ConversationRoom.findById(ctx, channelId);
        //
        //     if (!channel || channel!.kind !== 'public' || (channel.oid && (await Store.Organization.findById(ctx, channel.oid))!.kind !== 'community')) {
        //         return null;
        //     }
        //
        //     let profile = await Store.RoomProfile.findById(ctx, channelId);
        //     if (!profile) {
        //         return null;
        //     }
        //     let membersCount = profile.activeMembersCount || 0;
        //
        //     return {
        //         url,
        //         title: profile!.title || null,
        //         subtitle: membersCount < 10 ? `New ${channel && channel.isChannel ? 'channel' : 'group'}` : (membersCount + ' members'),
        //         description: profile!.description || null,
        //         imageInfo: profile!.image ? await Modules.Media.fetchFileInfo(rootCtx, profile!.image.uuid) : null,
        //         photo: profile!.image,
        //         photoPreview: profile!.image ? await Modules.Media.fetchLowResPreview(ctx, profile!.image.uuid) : null,
        //         hostname: null,
        //         iconRef: null,
        //         iconInfo: null,
        //         photoFallback: makePhotoFallback(IDs.Conversation.serialize(channelId), profile.title || 'deleted')
        //     };
        // })
        .specialUrl(/(localhost:3000|(app.|next.|)openland.com)\/(joinChannel|invite)\/(.*)/, false, async (url, data) => {
            let ctx = withReadOnlyTransaction(rootCtx);
            let [, , , , _invite] = data;

            let chatInvite = await Modules.Invites.resolveInvite(ctx, _invite);

            if (!chatInvite || !chatInvite.enabled) {
                return null;
            }

            let profile = await Store.RoomProfile.findById(ctx, chatInvite.channelId);
            let conv = await Store.ConversationRoom.findById(ctx, chatInvite.channelId);

            if (!profile) {
                return null;
            }
            let membersCount = profile.activeMembersCount || 0;

            return {
                url,
                title: profile!.title || null,
                subtitle: membersCount < 10 ? `New ${conv && conv.isChannel ? 'channel' : 'group'}` : (membersCount + ' members'),
                description: profile!.description || null,
                imageInfo: profile!.image ? await Modules.Media.fetchFileInfo(ctx, profile!.image.uuid) : null,
                photo: profile!.image,
                photoPreview: profile!.image ? await Modules.Media.fetchLowResPreview(ctx, profile!.image.uuid) : null,
                hostname: null,
                iconRef: null,
                iconInfo: null,
                keyboard: {
                    buttons: [[
                        { title: 'Join chat', style: 'DEFAULT', url }
                    ]]
                },
                photoFallback: makePhotoFallback(IDs.Conversation.serialize(profile.id), profile.title || 'deleted'),
                dynamic: true
            };
        })
        .specialUrl(/(localhost:3000|(app.|next.|)openland.com)\/(.*)/, false, async (url, data) => {
            let [, , , _shortname] = data;

            let { hostname } = URL.parse(url);

            let ownerId;
            let ownerType;
            try {
                let idInfo = IdsFactory.resolve(_shortname);
                if (idInfo.type.typeId === IDs.User.typeId) {
                    ownerType = 'user';
                } else if (idInfo.type.typeId === IDs.Organization.typeId) {
                    ownerType = 'org';
                }
                ownerId = idInfo.id as number;
            } catch {
                let shortname = await Modules.Shortnames.findShortname(rootCtx, _shortname);
                if (shortname) {
                    ownerId = shortname.ownerId;
                    ownerType = shortname.ownerType;
                }
            }

            if (!ownerId || !ownerType) {
                return null;
            }

            if (ownerType === 'user') {
                let userId = ownerId;
                let user = await Modules.Users.profileById(rootCtx, ownerId);

                return await getURLAugmentationForUser({ hostname, url, userId, user });
            } else if (ownerType === 'org') {
                let orgId = ownerId;

                let ctx = withReadOnlyTransaction(rootCtx);
                let org = await Store.OrganizationProfile.findById(ctx, orgId);
                let membersCount = (await Modules.Orgs.findOrganizationMembers(ctx, org!.id)).length;

                return {
                    url,
                    title: org!.name || null,
                    subtitle: `${membersCount} ${membersCount === 1 ? 'member' : 'members'}`,
                    description: org!.about || null,
                    imageInfo: org!.photo ? await Modules.Media.fetchFileInfo(ctx, org!.photo.uuid) : null,
                    photo: org!.photo || null,
                    photoPreview: org!.photo ? await Modules.Media.fetchLowResPreview(ctx, org!.photo.uuid) : null,
                    hostname: null,
                    iconRef: null,
                    iconInfo: null,
                    photoFallback: makePhotoFallback(IDs.Organization.serialize(org!.id), org!.name || 'deleted'),
                };
            } else {
                return null;
            }
        });

    return service;
}
