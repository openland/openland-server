import 'reflect-metadata';
import * as fdb from 'foundationdb';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { AllEntities, AllEntitiesDirect } from 'openland-module-db/schema';
import { OrganizationRepository } from './OrganizationRepository';
import { FConnection } from 'foundation-orm/FConnection';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { NoOpBus } from 'foundation-orm/tests/NoOpBus';
import { FWatch } from 'foundation-orm/FWatch';

describe('OrganizationRepository', () => {
    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let FDB: AllEntities;
    let repo: OrganizationRepository;

    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_orgs']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        FDB = new AllEntitiesDirect(new FConnection(db, NoOpBus));
        FWatch.POOL_TIMEOUT = 10;

        repo = new OrganizationRepository(FDB);
    });

    it('should create pending organization correctly', async () => {

        // Create Organization
        let id = (await repo.createOrganization(1, { name: 'my nice org ' }, { editorial: false, status: 'pending' })).id;

        // Check Result
        let org = await FDB.Organization.findById(id);
        expect(org).not.toBeNull();
        expect(org).not.toBeUndefined();
        expect(org!.ownerId).toEqual(1);
        expect(org!.kind).toEqual('organization');
        expect(org!.status).toEqual('pending');

        // Check profile
        let orgp = await FDB.OrganizationProfile.findById(org!.id);
        expect(orgp!.name).toEqual('my nice org');

        // Check editorial
        let edit = (await FDB.OrganizationEditorial.findById(id))!;
        expect(edit).not.toBeNull();
        expect(edit).not.toBeUndefined();
        expect(edit.featured).toEqual(false);
        expect(edit.listed).toEqual(true);

        // Check membership
        let members = await repo.findOrganizationMembership(id);
        expect(members.length).toBe(1);
        expect(members[0].uid).toBe(1);
        expect(members[0].status).toBe('joined');
        expect(members[0].role).toBe('admin');
    });

    it('should respect status', async () => {
        let id = (await repo.createOrganization(1, { name: 'title' }, { editorial: false, status: 'activated' })).id;
        let org = await FDB.Organization.findById(id);
        expect(org).not.toBeNull();
        expect(org).not.toBeUndefined();
        expect(org!.status).toEqual('activated');

        let id2 = (await repo.createOrganization(1, { name: 'title' }, { editorial: false, status: 'suspended' })).id;
        let org2 = await FDB.Organization.findById(id2);
        expect(org2).not.toBeNull();
        expect(org2).not.toBeUndefined();
        expect(org2!.status).toEqual('suspended');

        let id3 = (await repo.createOrganization(1, { name: 'title' }, { editorial: false, status: 'pending' })).id;
        let org3 = await FDB.Organization.findById(id3);
        expect(org3).not.toBeNull();
        expect(org3).not.toBeUndefined();
        expect(org3!.status).toEqual('pending');
    });
});