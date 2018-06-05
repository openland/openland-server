import { DB } from '../tables';
import { Repos } from '../repositories';
import { Transaction } from 'sequelize';

export class SuperRepository {
    async fetchAllOrganizations() {
        return await DB.Organization.findAll();
    }
    async fetchById(id: number, tx?: Transaction) {
        let res = await DB.Organization.findById(id, {transaction: tx});
        if (!res) {
            throw Error('Unabvle to find organization');
        }
        return res;
    }
    async createOrganization(title: string) {
        return await DB.tx(async (tx) => {
            let res = await DB.Organization.create({
                title: title
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
        org.title = title;
        await org.save();
        return org;
    }

    async activateOrganization(id: number) {
        let org = await this.fetchById(id);
        org.status = 'ACTIVATED';
        await org.save();
        return org;
    }

    async suspendOrganization(id: number) {
        let org = await this.fetchById(id);
        org.status = 'SUSPENDED';
        await org.save();
        return org;
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
        return this.fetchById(organizationId, tx);
    }

    async removeFromOrganization(organizationId: number, uid: number) {
        await DB.tx(async (tx) => {
            let isLast = (await DB.OrganizationMember.count({ where: { orgId: organizationId }, transaction: tx })) === 1;
            let existing = await DB.OrganizationMember.find({ where: { orgId: organizationId, userId: uid }, transaction: tx, lock: tx.LOCK.UPDATE });
            if (existing) {
                if (isLast) {
                    throw Error('Ypu can\'t remove last member from the organization');
                }
                await existing.destroy({ transaction: tx });
            }
        });
        return this.fetchById(organizationId);
    }
}