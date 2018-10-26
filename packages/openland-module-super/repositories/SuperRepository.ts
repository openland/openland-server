import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { UserError } from 'openland-server/errors/UserError';

export class SuperRepository {
    private readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async findAllSuperAdmins() {
        return (await this.entities.SuperAdmin.findAll()).filter((v) => v.enabled);
    }

    async findSuperRole(uid: number) {
        let res = await this.entities.SuperAdmin.findById(uid);
        if (res && res.enabled) {
            return res.role;
        } else {
            return null;
        }
    }

    async makeSuperAdmin(uid: number, role: string) {
        await inTx(async () => {
            let existing = await this.entities.SuperAdmin.findById(uid);
            if (existing) {
                existing.enabled = true;
                existing.role = role;
            } else {
                await this.entities.SuperAdmin.create(uid, { role, enabled: true });
            }
        });
    }

    async makeNormalUser(uid: number) {
        await inTx(async () => {
            if ((await this.findAllSuperAdmins()).length === 1) {
                throw new UserError('Unable to remove last Super User');
            }
            let existing = await this.entities.SuperAdmin.findById(uid);
            if (existing) {
                existing.enabled = false;
            }
        });
    }
}