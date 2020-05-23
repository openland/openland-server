import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../openland-module-db/FDB';
import { randomKey, randomString } from '../openland-utils/random';
import { uuid } from '../openland-utils/uuid';
import * as base64 from '../openland-utils/base64';
import { randomBytes } from 'crypto';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { InvalidInputError } from '../openland-errors/InvalidInputError';
import { injectable } from 'inversify';
import { NotFoundError } from '../openland-errors/NotFoundError';
import { ImageRef } from '../openland-module-media/ImageRef';
import { Modules } from 'openland-modules/Modules';
import { Sanitizer } from '../openland-utils/Sanitizer';
import { fetchNextDBSeq } from '../openland-utils/dbSeq';

export enum OauthScope {
    All = 'all',
    Zapier = 'zapier'
}

function isValidScope(scope: string) {
    return [...Object.values(OauthScope)].includes(scope as any);
}

@injectable()
export class OauthModule {
    start = async () => {
        // no op
    }

    async createApp(
        parent: Context, uid: number,
        title: string, scopes?: OauthScope[] | null,
        allowedRedirectUrls?: string[] | null, image?: ImageRef | null) {
        return await inTx(parent, async ctx => {
            let allowedScopes = scopes || ['all'];
            if (title.trim().length === 0) {
                throw new InvalidInputError([{ key: 'title', message: 'Title shouldn\'t be empty' }]);
            }

            if (image) {
                await Modules.Media.saveFile(ctx, image.uuid);
                image = Sanitizer.sanitizeImageRef(image);
            }

            return await Store.OauthApplication.create(ctx, await fetchNextDBSeq(ctx, 'ouath-app-id'), {
                uid,
                clientSecret: randomBytes(32).toString('hex'),
                clientId: randomBytes(16).toString('hex'),
                allowedScopes,
                allowedRedirectUrls,
                title,
                image,
                enabled: true,
            });
        });
    }

    async updateApp(
        parent: Context, id: number,
        title?: string | null, scopes?: OauthScope[] | null,
        allowedRedirectUrls?: string[] | null, image?: ImageRef | null) {
        return await inTx(parent, async ctx => {

            let app = await Store.OauthApplication.findById(ctx, id);
            if (!app) {
                throw new NotFoundError();
            }

            if (title) {
                app.title = title;
            }
            if (scopes) {
                app.allowedScopes = scopes;
            }
            if (allowedRedirectUrls) {
                app.allowedRedirectUrls = allowedRedirectUrls;
            }
            if (image) {
                await Modules.Media.saveFile(ctx, image.uuid);
                image = Sanitizer.sanitizeImageRef(image);

                app.image = image;
            }

            await app.flush(ctx);
            return app;
        });
    }

    async createAuth(parent: Context, clientId: string, scopes: OauthScope[], state: string, redirectUrl: string) {
        return await inTx(parent, async ctx => {
            let oapp = await Store.OauthApplication.byClientId.find(ctx, clientId);
            if (!oapp || !oapp.enabled) {
                throw new AccessDeniedError();
            }

            if (!oapp.allowedScopes.includes('all')) {
                for (let scope of scopes) {
                    if (!isValidScope(scope)) {
                        throw new AccessDeniedError();
                    }
                }
            }

            if (oapp.allowedRedirectUrls && !oapp.allowedRedirectUrls.includes(redirectUrl)) {
                throw new AccessDeniedError();
            }

            let auth = await Store.OauthContext.create(ctx, randomString(10), {
                state: state,
                redirectUrl: redirectUrl,
                clientId: clientId,
                scopes: scopes,
                code: randomKey(),
                enabled: true,
            });
            await auth.flush(ctx);
            return auth;
        });
    }

    async createToken(parent: Context, clientId: string, uid: number, scopes: OauthScope[]) {
        return await inTx(parent, async (ctx) => {
            return await Store.OauthToken.create(ctx, uuid(), {
                uid,
                clientId,
                scopes: scopes,
                salt: base64.encodeBuffer(randomBytes(64)),
                enabled: true,
            });
        });
    }
}
