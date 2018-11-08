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

    it('should create organization and set primary organization for user', async () => {

        // Create Test User
        let u = await user.createUser('authid', 'some@email.com');
        let p = await user.createUserProfile(u.id, { firstName: 'user' });
        expect(p.primaryOrganization).toBeNull();

        // Create Organization
        let id = (await repo.createOrganization(u.id, {
            name: 'my nice org '
        }, false)).id;

        // Check Result
        let org = await FDB.Organization.findById(id);
        expect(org).not.toBeNull();
        expect(org).not.toBeUndefined();
        expect(org!.ownerId).toEqual(u.id);
        let orgp = await FDB.OrganizationProfile.findById(org!.id);
        expect(orgp!.name).toEqual('my nice org');

        // Check user profile
        let p2 = (await FDB.UserProfile.findById(u.id))!;
        expect(p2.primaryOrganization).toEqual(org!.id);
    });
});