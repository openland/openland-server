import { DB } from '../tables';
import { Repos } from '../repositories';

export class SuperRepository {
    async fetchAllOrganizations() {
        return await DB.Organization.findAll();
    }
    async fetchById(id: number) {
        let res = await DB.Organization.findById(id);
        if (!res) {
            throw Error('Unabvle to find organization');
        }
        return res;
    }
    async createOrganization(title: string) {        
        return await DB.tx(async (tx) => {
            let res = await DB.Organization.create({
                title: title
            }, {transaction: tx});

            let defaultFolder = ['1. Incoming', '2. Review', '3. Approved', '4. Snoozed', '5. Rejected'];
            for (let folderName of defaultFolder) {
                await Repos.Folders.createFolder(res.id!!, folderName, tx);
            }
            return res;
        });
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

    async assingOrganization(organizationId: number, uid: number) {
        let existing = await DB.User.findById(uid);
        if (existing === null) {
            throw Error('Unable to find user');
        }
        if (existing.organizationId !== null) {
            throw Error('User already belongs to an organization');
        }
        existing.organizationId = organizationId;
        await existing.save();
        return this.fetchById(organizationId);
    }

    async detachOrganization(organizationId: number, uid: number) {
        let existingOrg = await this.fetchById(organizationId);
        let existing = await DB.User.findById(uid);
        if (existing === null) {
            throw Error('Unable to find user');
        }
        if (existing.organizationId === null) {
            throw Error('User doesnt belong to an organization');
        }
        if (existing.organizationId !== existingOrg.id) {
            throw Error('Organization id mismatch');
        }
        existing.organizationId = null;
        await existing.save();
        return this.fetchById(organizationId);
    }
}