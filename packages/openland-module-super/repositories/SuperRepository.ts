import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { UserError } from 'openland-errors/UserError';
import { Context } from 'openland-utils/Context';

export class SuperRepository {
    private readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async findAllSuperAdmins(ctx: Context) {
        return (await this.entities.SuperAdmin.findAll(ctx)).filter((v) => v.enabled);
    }

    async findSuperRole(ctx: Context, uid: number) {
        let res = await this.entities.SuperAdmin.findById(ctx, uid);
        if (res && res.enabled) {
            return res.role;
        } else {
            return null;
        }
    }

    async makeSuperAdmin(parent: Context, uid: number, role: string) {
        await inTx(parent, async (ctx) => {
            let existing = await this.entities.SuperAdmin.findById(ctx, uid);
            if (existing) {
                existing.enabled = true;
                existing.role = role;
            } else {
                await this.entities.SuperAdmin.create(ctx, uid, { role, enabled: true });
            }
        });
    }

    async makeNormalUser(parent: Context, uid: number) {
        await inTx(parent, async (ctx) => {
            if ((await this.findAllSuperAdmins(ctx)).length === 1) {
                throw new UserError('Unable to remove last Super User');
            }
            let existing = await this.entities.SuperAdmin.findById(ctx, uid);
            if (existing) {
                existing.enabled = false;
            }
        });
    }
}