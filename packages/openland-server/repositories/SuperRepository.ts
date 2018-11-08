import { NotFoundError } from '../errors/NotFoundError';
import { UserError } from '../errors/UserError';
import { ErrorText } from '../errors/ErrorText';
import { Emails } from '../../openland-module-email/Emails';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';

export class SuperRepository {
    
    async fetchById(id: number) {
        let res = await FDB.Organization.findById(id);
        if (!res) {
            throw new NotFoundError(ErrorText.unableToFindOrganization);
        }
        return res;
    }

    async renameOrganization(id: number, title: string) {
        return await inTx(async () => {
            let org = await FDB.Organization.findById(id);
            let profile = await FDB.OrganizationProfile.findById(id);
            profile!.name = title;
            return org;
        });
    }

    async activateOrganization(id: number) {
        return await inTx(async () => {
            let org = (await FDB.Organization.findById(id))!;
            if (org.status !== 'activated') {
                org.status = 'activated';
                for (let m of await FDB.OrganizationMember.allFromOrganization('joined', org.id)) {
                    let u = (await FDB.User.findById(m.uid));
                    if (u!.status !== 'activated') {
                        await Emails.sendWelcomeEmail(u!.id);
                        u!.status = 'activated';
                    }
                }
            }
            return org;
        });
    }

    async pendOrganization(id: number) {
        return await inTx(async () => {
            let org = (await FDB.Organization.findById(id))!;
            org.status = 'pending';
        });
    }

    async suspendOrganization(id: number) {
        return await inTx(async () => {
            let org = (await FDB.Organization.findById(id))!;
            if (org.status !== 'pending') {
                org.status = 'pending';
                await Emails.sendAccountDeactivatedEmail(org.id!!);
            }
        });
    }

    async addToOrganization(organizationId: number, uid: number) {
        // let existing = await DB.OrganizationMember.find({ where: { orgId: organizationId, userId: uid }, transaction: tx, lock: tx.LOCK.UPDATE });
        // if (existing) {
        //     return;
        // }
        // await DB.OrganizationMember.create({
        //     userId: uid,
        //     orgId: organizationId,
        //     isOwner: true
        // }, { transaction: tx });

        await inTx(async () => {
            let ex = await FDB.OrganizationMember.findById(organizationId, uid);
            if (ex) {
                if (ex.status === 'joined') {
                    return;
                } else {
                    ex.status = 'joined';
                }
            } else {
                await FDB.OrganizationMember.create(organizationId, uid, { status: 'joined', role: 'member' });
            }
            let profile = await Modules.Users.profileById(uid);
            if (profile && !profile.primaryOrganization) {
                profile.primaryOrganization = organizationId;
            }
        });

        return this.fetchById(organizationId);
    }

    async removeFromOrganization(organizationId: number, uid: number) {
        await inTx(async () => {
            let isLast = (await FDB.OrganizationMember.allFromOrganization('joined', organizationId)).length <= 1;
            let existing = await FDB.OrganizationMember.findById(organizationId, uid);
            if (existing && existing.status === 'joined') {
                if (isLast) {
                    throw new UserError(ErrorText.unableToRemoveLastMember);
                }

                let profile = await Modules.Users.profileById(uid);
                profile!.primaryOrganization = (await Modules.Orgs.findUserOrganizations(uid))[0];
            }

        });
        return this.fetchById(organizationId);
    }
}