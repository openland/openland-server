import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { AllEntities, UserStorageRecord } from '../../openland-module-db/schema';
import { Context } from '@openland/context';
import { inTx } from '../../foundation-orm/inTx';
import { Modules } from '../../openland-modules/Modules';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { errors } from 'elasticsearch';
import InternalServerError = errors.InternalServerError;
import { randomKey } from '../../openland-utils/random';
import { ImageRef } from '../../openland-module-media/ImageRef';
import { stringNotEmpty, validate } from '../../openland-utils/NewInputValidator';
import { resolveSequenceNumber } from 'openland-module-db/resolveSequenceNumber';

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

            await appUser!.flush(ctx);
            await Modules.Users.markForUndexing(ctx, appUser!.id);
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
            await appUser!.flush(ctx);
            await Modules.Users.markForUndexing(ctx, appUser!.id);
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

    async writeKeys(parent: Context, uid: number, namespace: string, data: { key: string, value?: null | undefined | string }[]) {
        return await inTx(parent, async (ctx) => {
            let keys = await this.fetchKeys(ctx, uid, namespace, data.map((v) => v.key));
            for (let k of keys) {
                let upd = data.find((v) => v.key === k.key)!;
                if (upd.value) {
                    k.value = upd.value;
                } else {
                    k.value = null;
                }
            }
            return keys;
        });
    }

    async fetchKeys(parent: Context, uid: number, namespace: string, keys: string[]) {
        return await inTx(parent, async (ctx) => {
            let ns = await this.resolveNamespace(ctx, namespace);
            let res: UserStorageRecord[] = [];
            for (let k of keys) {
                let ex = await this.entities.UserStorageRecord.findFromKey(ctx, uid, ns, k);
                if (ex) {
                    res.push(ex);
                } else {
                    let id = await resolveSequenceNumber(ctx, this.entities, 'user-record-id');
                    res.push(await this.entities.UserStorageRecord.create(ctx, uid, id, { key: k, ns, value: null }));
                }
            }
            return res;
        });
    }

    private async resolveNamespace(parent: Context, namespace: string) {
        return await inTx(parent, async (ctx) => {
            let existing = await this.entities.UserStorageNamespace.findFromNamespace(ctx, namespace);
            if (existing) {
                return existing.id;
            }
            let id = await resolveSequenceNumber(ctx, this.entities, 'namespace-id');
            await this.entities.UserStorageNamespace.create(ctx, id, { ns: namespace });
            return id;
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