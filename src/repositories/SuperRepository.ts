import { DB } from '../tables';

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
        return await DB.Organization.create({
            title: title
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
}