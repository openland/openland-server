import { createUsers } from './createUsers';
import { createOrganizations } from './createOrganizations';

export default async function initTestDatabase() {
    await createUsers();
    await createOrganizations();
}