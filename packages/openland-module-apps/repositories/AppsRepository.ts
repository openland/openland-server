import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { AllEntities } from '../../openland-module-db/schema';
import { Context } from '../../openland-utils/Context';
import { inTx } from '../../foundation-orm/inTx';
import { Modules } from '../../openland-modules/Modules';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { errors } from 'elasticsearch';
import InternalServerError = errors.InternalServerError;
import { randomKey } from '../../openland-utils/random';
import { ImageRef } from '../../openland-module-media/ImageRef';

@injectable()
export class AppsRepository {
    @lazyInject('FDB')
    private readonly entities!: AllEntities;

    async createApp(parent: Context, uid: number, name: string, extra: { photo?: ImageRef, about?: string, shortname?: string }) {
        return await inTx(parent, async (ctx) => {
            if (!await this.canCreateApp(ctx, uid)) {
                throw new AccessDeniedError();
            }

            let rnd = randomKey();
            let email = `app-${rnd}@openland.com`;

            let appUser = await Modules.Users.createUser(ctx, 'user-app-' + rnd, email);
            await Modules.Users.activateUser(ctx, appUser.id);
            appUser.isBot = true;
            appUser.botOwner = uid;

            await Modules.Users.createUserProfile(ctx, appUser.id, { firstName: name, email: email });
            await Modules.Auth.createToken(ctx, appUser.id);
            let profile = await Modules.Users.profileById(ctx, appUser.id);

            if (extra.about) {
                profile!.about = extra.about;
            }
            if (extra.photo) {
                await Modules.Media.saveFile(ctx, extra.photo.uuid);
                profile!.picture = extra.photo;
            }
            if (extra.shortname) {
                await Modules.Shortnames.setShortnameToUser(ctx, extra.shortname, appUser.id);
            }

            return appUser;
        });
    }

    async findAppsCreatedByUser(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let apps = await this.entities.User.allFromOwner(ctx, uid);
            return apps.filter(app => app.status !== 'deleted');
        });
    }

    async getAppToken(parent: Context, uid: number, appId: number) {
        return await inTx(parent, async (ctx) => {
            if (!this.isAppOwner(ctx,  uid, appId)) {
                throw new AccessDeniedError();
            }
            let tokens = await this.entities.AuthToken.allFromUser(ctx, appId);

            if (tokens.length === 0) {
                throw new InternalServerError();
            } else if (tokens.length > 1) {
                // internal inconsistency
                // app should have only one active token
                throw new InternalServerError();
            }

            return tokens[0];
        });
    }

    async refreshAppToken(parent: Context, uid: number, appId: number) {
        return await inTx(parent, async (ctx) => {
            if (!this.isAppOwner(ctx,  uid, appId)) {
                throw new AccessDeniedError();
            }
            let token = await this.getAppToken(ctx, uid, appId);
            await Modules.Auth.revokeToken(ctx, token.salt);
            await Modules.Auth.createToken(ctx, appId);
        });
    }

    async isAppOwner(parent: Context, uid: number, appId: number) {
        return await inTx(parent, async (ctx) => {
            let appUser = await this.entities.User.findById(ctx, appId);

            return appUser && appUser.botOwner === uid;
        });
    }

    private async canCreateApp(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let user = await this.entities.User.findById(ctx, uid);

            if (!user || user.status !== 'activated') {
                return false;
            }

            return true;
        });
    }
}