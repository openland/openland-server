import { DB } from '../tables';

export class SuperRepository {
    async fetchAllOrganizations() {
        return await DB.Organization.findAll();
    }
    async fetchById(id: number) {
        return await DB.Organization.findById(id);
    }
}