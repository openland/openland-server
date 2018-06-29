import { createUsers } from './createUsers';

export default async function initTestDatabase() {
    await createUsers();
}