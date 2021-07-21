import fetch from 'node-fetch';
import { Context, createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { CacheRepository } from '../../openland-module-cache/CacheRepository';
import { buildBaseImageUrl, ImageRef } from '../../openland-module-media/ImageRef';
import { Store } from 'openland-module-db/FDB';
import { injectable } from 'inversify';
import { Modules } from '../../openland-modules/Modules';
import { createSocialImageLayout } from './createSocialImageLayout';

const rootCtx = createNamedContext('social-image');
const logger = createLogger('social-image');

const cache = new CacheRepository<{ generated: ImageRef }>('social-image');

@injectable()
export class SocialImageRepository {
    onRoomUpdated = async (ctx: Context, cid: number) => {
        await cache.delete(ctx, `room-${cid}`);
    }

    getRoomSocialImage = async (ctx: Context, cid: number): Promise<ImageRef | null> => {
        let conv = await Store.RoomProfile.findById(ctx, cid);
        if (!conv) {
            return null;
        }
        if (conv.socialImage) {
            return conv.socialImage;
        }
        if (!conv.image) {
            return null;
        }

        let cached = await cache.read(ctx, `room-${cid}`);
        if (cached) {
            return cached.generated;
        }

        // truncate conv title
        let title = conv.title;
        if (title.length > 20) {
            title = title.slice(0, 17) + '...';
        }

        let generated = await this.renderSocialImage(title, buildBaseImageUrl(conv.image), 'Join on Openland');
        if (!generated) {
            return null;
        }
        await cache.write(ctx, `room-${cid}`, { generated });
        return generated;
    }

    onUserUpdated = async (ctx: Context, uid: number) => {
        await cache.delete(ctx, `user-${uid}`);
    }

    getUserSocialImage = async (ctx: Context, uid: number): Promise<ImageRef | null> => {
        let cached = await cache.read(ctx, `user-${uid}`);
        if (cached) {
            return cached.generated;
        }

        let userProfile = await Store.UserProfile.findById(ctx, uid);
        if (!userProfile) {
            return null;
        }
        if (!userProfile.picture) {
            return null;
        }

        // truncate conv title
        let title = await Modules.Users.getUserFullName(ctx, uid);
        if (title.length > 20) {
            title = title.slice(0, 17) + '...';
        }

        let generated = await this.renderSocialImage(title, buildBaseImageUrl(userProfile.picture), 'Connect on Openland');
        if (!generated) {
            return null;
        }
        await cache.write(ctx, `user-${uid}`, { generated });
        return generated;
    }

    onOrganizationUpdated = async (ctx: Context, oid: number) => {
        await cache.delete(ctx, `org-${oid}`);
    }

    getOrganizationSocialImage = async (ctx: Context, oid: number): Promise<ImageRef | null> => {
        let cached = await cache.read(ctx, `org-${oid}`);
        if (cached) {
            return cached.generated;
        }

        let org = await Store.OrganizationProfile.findById(ctx, oid);
        if (!org) {
            return null;
        }
        if (!org.photo) {
            return null;
        }

        // truncate conv title
        let title = org.name;
        if (title.length > 20) {
            title = title.slice(0, 17) + '...';
        }

        let generated = await this.renderSocialImage(title, buildBaseImageUrl(org.photo), 'Join on Openland');
        if (!generated) {
            return null;
        }
        await cache.write(ctx, `org-${oid}`, { generated });
        return generated;
    }

    private renderSocialImage = async (title: string, image: string | null, subTitle: string): Promise<ImageRef | null> => {
        try {
            let res = await fetch('https://web-tools.korshakov.com/api/browser-render', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    body: createSocialImageLayout({ title, image, subtitle: subTitle }),
                    width: 600,
                    height: 300,
                    scale: 2
                }),
                timeout: 30000
            });

            logger.log(rootCtx, 'social image fetch status ', res.status, title);
            if (res.status !== 200) {
                return null;
            }

            // Upload image
            let imageData = await res.buffer();
            let uploaded = await Modules.Media.upload(rootCtx, imageData, 'png');

            // Result
            return {
                uuid: uploaded.file,
                crop: null,
            };
        } catch (e) {
            return null;
        }
    }
}