import { inTx } from '@openland/foundationdb';
import { UserError } from 'openland-errors/UserError';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';

export class SuperRepository {

    async findAllSuperAdmins(ctx: Context) {
        return (await Store.SuperAdmin.findAll(ctx)).filter((v) => v.enabled);
    }

    async findSuperRole(ctx: Context, uid: number) {
        let res = await Store.SuperAdmin.findById(ctx, uid);
        if (res && res.enabled) {
            return res.role;
        } else {
            return null;
        }
    }

    async makeSuperAdmin(parent: Context, uid: number, role: string) {
        await inTx(parent, async (ctx) => {
            let existing = await Store.SuperAdmin.findById(ctx, uid);
            if (existing) {
                existing.enabled = true;
                existing.role = role;
            } else {
                await Store.SuperAdmin.create(ctx, uid, { role, enabled: true });
            }
        });
    }

    async makeNormalUser(parent: Context, uid: number) {
        await inTx(parent, async (ctx) => {
            if ((await this.findAllSuperAdmins(ctx)).length === 1) {
                throw new UserError('Unable to remove last Super User');
            }
            let existing = await Store.SuperAdmin.findById(ctx, uid);
            if (existing) {
                existing.enabled = false;
            }
        });
    }
}