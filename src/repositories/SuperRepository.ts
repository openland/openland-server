import { DB } from '../tables';
import { Repos } from '.';
import { Transaction } from 'sequelize';
import { NotFoundError } from '../errors/NotFoundError';
import { UserError } from '../errors/UserError';
import { ErrorText } from '../errors/ErrorText';
import { Emails } from '../services/Emails';

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

            let defaultFolder = ['1. Incoming', '2. Review', '3. Approved', '4. Snoozed', '5. Rejected'];
            for (let folderName of defaultFolder) {
                await Repos.Folders.createFolder(res.id!!, folderName, tx);
            }
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
        return await DB.tx(async (tx) => {
            let org = await this.fetchById(id, tx);
            if (org.status !== 'ACTIVATED') {
                org.status = 'ACTIVATED';
                await org.save({ transaction: tx });
                await Emails.sendAccountActivatedEmail(org.id!!, tx);
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
        let existing = await DB.OrganizationMember.find({ where: { orgId: organizationId, userId: uid }, transaction: tx, lock: tx.LOCK.UPDATE });
        if (existing) {
            return;
        }
        await DB.OrganizationMember.create({
            userId: uid,
            orgId: organizationId,
            isOwner: true
        }, { transaction: tx });

        let user = await DB.UserProfile.find({ where: { userId: uid }, transaction: tx, lock: tx.LOCK.UPDATE });
        if (user && !user.primaryOrganization) {
            user.primaryOrganization = organizationId;
            user.save({ transaction: tx });
        }

        return this.fetchById(organizationId, tx);
    }

    async removeFromOrganization(organizationId: number, uid: number) {
        await DB.tx(async (tx) => {
            let isLast = (await DB.OrganizationMember.count({ where: { orgId: organizationId }, transaction: tx })) === 1;
            let existing = await DB.OrganizationMember.find({ where: { orgId: organizationId, userId: uid }, transaction: tx, lock: tx.LOCK.UPDATE });
            if (existing) {
                if (isLast) {
                    throw new UserError(ErrorText.unableToRemoveLastMember);
                }
                await existing.destroy({ transaction: tx });
            }
        });
        return this.fetchById(organizationId);
    }
}