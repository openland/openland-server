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
import { stringNotEmpty, validate } from '../../openland-utils/NewInputValidator';

@injectable()
export class AppsRepository {
    @lazyInject('FDB')
    private readonly entities!: AllEntities;

    async createApp(parent: Context, uid: number, name: string, extra: { photo?: ImageRef, about?: string, shortname?: string, isSuperBot?: boolean }) {
        return await inTx(parent, async (ctx) => {
            if (!await this.canCreateApp(ctx, uid)) {
                throw new AccessDeniedError();
            }

            await validate(
                stringNotEmpty('Name can\'t be empty!'),
                name,
                'input.name'
            );

            let rnd = randomKey();
            let email = `app-${rnd}@openland.com`;

            let appUser = await Modules.Users.createUser(ctx, 'user-app-' + rnd, email);
            await Modules.Users.activateUser(ctx, appUser.id, false);
            appUser.isBot = true;
            appUser.botOwner = uid;
            appUser.isSuperBot = extra.isSuperBot !== undefined ? extra.isSuperBot : false;

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

            let isSuperAdmin = (await Modules.Super.superRole(ctx, uid)) === 'super-admin';
            if (isSuperAdmin) {
                apps = [...apps, ...(await this.entities.User.allFromSuperBots(ctx)).filter(bot => bot.botOwner !== uid)];
            }
            return apps.filter(app => app.status !== 'deleted');
        });
    }

    async getAppToken(parent: Context, uid: number, appId: number) {
        return await inTx(parent, async (ctx) => {
            await this.checkAppAccess(ctx, uid, appId);
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
            await this.checkAppAccess(ctx, uid, appId);
            let token = await this.getAppToken(ctx, uid, appId);
            await Modules.Auth.revokeToken(ctx, token.salt);
            await Modules.Auth.createToken(ctx, appId);
        });
    }

    async isAppOwner(parent: Context, uid: number, appId: number) {
        return await inTx(parent, async (ctx) => {
            let isSuperAdmin = (await Modules.Super.superRole(ctx, uid)) === 'super-admin';
            if (isSuperAdmin) {
                return true;
            }

            let appUser = await this.entities.User.findById(ctx, appId);

            return appUser && appUser.botOwner === uid;
        });
    }

    async deleteApp(parent: Context, uid: number, appId: number) {
        return await inTx(parent, async (ctx) => {
            await this.checkAppAccess(ctx, uid, appId);
            let appUser = await this.entities.User.findById(ctx, appId);
            appUser!.status = 'deleted';
            return true;
        });
    }

    async createChatHook(parent: Context, uid: number, appId: number, cid: number) {
        return await inTx(parent, async (ctx) => {
            await this.checkAppAccess(ctx, uid, appId);
            let hook = await this.entities.AppHook.findById(ctx, appId, cid);
            if (hook) {
                hook.key = randomKey();
            } else {
                hook = await this.entities.AppHook.create(ctx, appId, cid, { key: randomKey() });
            }

            await Modules.Hooks.onAppHookCreated(parent, uid, hook);

            return hook;
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

    private async checkAppAccess(ctx: Context, uid: number, appId: number) {
        if (!await this.isAppOwner(ctx, uid, appId)) {
            throw new AccessDeniedError();
        }
    }
}