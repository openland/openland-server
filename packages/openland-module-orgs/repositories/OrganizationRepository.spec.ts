import * as fdb from 'foundationdb';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { AllEntities } from 'openland-module-db/schema';
import { OrganizationRepository } from './OrganizationRepository';
import { FConnection } from 'foundation-orm/FConnection';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { NoOpBus } from 'foundation-orm/tests/NoOpBus';
import { FWatch } from 'foundation-orm/FWatch';
import { UserRepository } from 'openland-module-users/repositories/UsersRepository';

describe('OrganizationRepository', () => {
    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let FDB: AllEntities;
    let repo: OrganizationRepository;
    let user: UserRepository;

    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_orgs']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        FDB = new AllEntities(new FConnection(db, NoOpBus));
        FWatch.POOL_TIMEOUT = 10;

        repo = new OrganizationRepository(FDB);
        user = new UserRepository(FDB);
    });

    it('should create organization', async () => {

        // Create Test User
        let u = await user.createUser('authid', 'some@email.com');

        // Create Organization
        await repo.createOrganization(u.id, {
            name: 'my nice org'
        }, false);
    });
});