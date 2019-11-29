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

export enum OauthScope {
    All = 'all',
    Zapier = 'zapier'
}

function isValidScope(scope: String) {
    return Object.values(OauthScope).includes(scope);
}

@injectable()
export class OauthModule {
    start = () => {
        // no op
    }

    async createApp(parent: Context, uid: number, title: string, scopes?: OauthScope[] | null, allowedRedirectUrls?: string[] | null) {
        return await inTx(parent, async ctx => {
            let allowedScopes = scopes || ['all'];
            if (title.trim().length === 0) {
                throw new InvalidInputError([{ key: 'title', message: 'Title shouldn\'t be empty' }]);
            }

            return await Store.OauthApplication.create(ctx, randomBytes(16).toString('hex'), {
                uid,
                clientSecret: randomBytes(32).toString('hex'),
                allowedScopes,
                allowedRedirectUrls,
                title,
                enabled: true
            });
        });
    }

    async updateApp(parent: Context, clientId: string, title?: string | null, scopes?: OauthScope[] | null, allowedRedirectUrls?: string[] | null) {
        return await inTx(parent, async ctx => {

            let app = await Store.OauthApplication.findById(ctx, clientId);
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

            await app.flush(ctx);
            return app;
        });
    }

    async createAuth(parent: Context, clientId: string, scopes: OauthScope[], state: string, redirectUrl: string) {
        return await inTx(parent, async ctx => {
            let oapp = await Store.OauthApplication.findById(ctx, clientId);
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
                enabled: true
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
