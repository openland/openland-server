import { Config } from 'openland-config/Config';
import fetch from 'node-fetch';
import { Context, createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { CacheRepository } from '../../openland-module-cache/CacheRepository';
import { buildBaseImageUrl, ImageRef } from '../../openland-module-media/ImageRef';
import { Store } from 'openland-module-db/FDB';
import { injectable } from 'inversify';

const rootCtx = createNamedContext('social-image');
const logger = createLogger('social-image');

const cache = new CacheRepository<{
    title: string,
    image: ImageRef,
    generated: ImageRef
}>('social-image');

@injectable()
export class SocialImageRepository {
    onRoomUpdated = async (ctx: Context, cid: number) => {
        let profile = await Store.RoomProfile.findById(ctx, cid);
        if (!profile) {
            return;
        }

        let cached = await cache.read(ctx, `room-${cid}`);
        if (cached && (cached.title !== profile.title || cached.image !== profile.image)) {
            await cache.delete(ctx, `room-${cid}`);
        }
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
        let title =  conv.title;
        if (title.length > 20) {
            title = title.slice(0, 17) + '...';
        }

        let generated = await this.renderSocialImage(title, buildBaseImageUrl(conv.image));
        if (!generated) {
            return null;
        }
        await cache.write(ctx, `room-${cid}`, {
            generated,
            title: conv.title,
            image: conv.image
        });
        return generated;
    }

    renderSocialImage = async (title: string, image: string | null): Promise<ImageRef | null> => {
        let res = await fetch(Config.screenshotter + '/render', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                template: 'sharing2',
                args: {
                    title,
                    image,
                    subTitle: 'join on Openland'
                }
            })
        });

        logger.log(rootCtx, 'social image fetch status ', res.status, title);
        if (res.status !== 200) {
            return null;
        }
        let json = await res.json();

        return {
            uuid: json.file,
            crop: null,
        };
    }
}