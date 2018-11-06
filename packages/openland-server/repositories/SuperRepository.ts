import { DB } from '../tables';
import { Repos } from '.';
import { Transaction } from 'sequelize';
import { NotFoundError } from '../errors/NotFoundError';
import { UserError } from '../errors/UserError';
import { ErrorText } from '../errors/ErrorText';
import { Emails } from '../services/Emails';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';

export class SuperRepository {
    async fetchAllOrganizations() {
        return await DB.Organization.findAll({ order: [['createdAt', 'DESC']] });
    }
    async fetchById(id: number, tx?: Transaction) {
        let res = await DB.Organization.findById(id, { transaction: tx });
        if (!res) {
            throw new NotFoundError(ErrorText.unableToFindOrganization);
        }
        return res;
    }
    async createOrganization(title: string) {
        return await DB.tx(async (tx) => {
            let res = await DB.Organization.create({
                name: title
            }, { transaction: tx });
            return res;
        });
    }

    async renameOrganization(id: number, title: string) {
        let org = await this.fetchById(id);
        org.name = title;
        await org.save();
        return org;
    }

    async activateOrganization(id: number) {
        return await DB.txStable(async (tx) => {
            let org = await this.fetchById(id, tx);
            if (org.status !== 'ACTIVATED') {
                org.status = 'ACTIVATED';
                await org.save({ transaction: tx });
                await Emails.sendAccountActivatedEmail(org.id!!, tx);

                let members = await FDB.OrganizationMember.allFromOrganization('joined', id);

                for (let m of members) {
                    let u = (await DB.User.findById(m.uid, { transaction: tx }))!;
                    u.status = 'ACTIVATED';
                    await u.save({ transaction: tx });

                    await Repos.Chats.addToInitialChannel(u.id!, tx);
                }
            }
            return org;
        });
    }

    async pendOrganization(id: number) {
        return await DB.tx(async (tx) => {
            let org = await this.fetchById(id, tx);
            if (org.status !== 'PENDING') {
                org.status = 'PENDING';
                await org.save({ transaction: tx });
            }
            return org;
        });
    }

    async suspendOrganization(id: number) {
        return await DB.tx(async (tx) => {
            let org = await this.fetchById(id, tx);
            if (org.status !== 'SUSPENDED') {
                org.status = 'SUSPENDED';
                await org.save({ transaction: tx });
                await Emails.sendAccountDeactivatedEmail(org.id!!, tx);
            }
            return org;
        });
    }

    async addToOrganization(organizationId: number, uid: number, tx: Transaction) {
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

        return this.fetchById(organizationId, tx);
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
                profile!.primaryOrganization = (await Repos.Users.fetchUserAccounts(uid))[0];
            }

        });
        return this.fetchById(organizationId);
    }
}