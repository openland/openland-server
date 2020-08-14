import 'reflect-metadata';
import { OrganizationRepository } from './OrganizationRepository';
import { testEnvironmentEnd, testEnvironmentStart } from '../../openland-modules/testEnvironment';
import { container } from '../../openland-modules/Modules.container';
import { DBModule } from '../../openland-module-db/DBModule';
import { UsersModule } from '../../openland-module-users/UsersModule';
import { UserRepository } from '../../openland-module-users/repositories/UserRepository';
import { Modules } from '../../openland-modules/Modules';
import { Context, createNamedContext } from '@openland/context';
import { loadUsersModule } from '../../openland-module-users/UsersModule.container';
import { Store } from 'openland-module-db/FDB';
import { ShortnameModule } from '../../openland-module-shortname/ShortnameModule';
import { loadShortnameModule } from '../../openland-module-shortname/ShortnameModule.container';

describe('OrganizationRepository', () => {
    async function createUser(ctx: Context, index: number) {
        let user = await Modules.Users.createUser(ctx, {email: index + 'some@email.comn'});
        await Modules.Users.createUserProfile(ctx, user.id, { firstName: 'Some Name' });
        return user;
    }

    beforeAll(async () => {
        await testEnvironmentStart('organization_repo');
        container.bind('OrganizationRepository').to(OrganizationRepository).inSingletonScope();
        container.bind('DBModule').to(DBModule).inSingletonScope();
        container.bind(UsersModule).toSelf().inSingletonScope();
        container.bind(ShortnameModule).toSelf().inSingletonScope();
        loadShortnameModule();
        loadUsersModule();
    });
    afterAll( async () => {
      await  testEnvironmentEnd();
    });

    it('should create pending organization correctly', async () => {
        let repo = container.get<OrganizationRepository>('OrganizationRepository');
        let ctx = createNamedContext('test');

        // Create Organization
        let id = (await repo.createOrganization(ctx, 1, { name: 'my nice org ' }, { editorial: false, status: 'pending' })).id;

        // Check Result
        let org = await Store.Organization.findById(ctx, id);
        expect(org).not.toBeNull();
        expect(org).not.toBeUndefined();
        expect(org!.ownerId).toEqual(1);
        expect(org!.kind).toEqual('organization');
        expect(org!.status).toEqual('pending');

        // Check profile
        let orgp = await Store.OrganizationProfile.findById(ctx, org!.id);
        expect(orgp!.name).toEqual('my nice org');

        // Check editorial
        let edit = (await Store.OrganizationEditorial.findById(ctx, id))!;
        expect(edit).not.toBeNull();
        expect(edit).not.toBeUndefined();
        expect(edit.featured).toEqual(false);
        expect(edit.listed).toEqual(true);

        // Check membership
        let members = await repo.findOrganizationMembership(ctx, id);
        expect(members.length).toBe(1);
        expect(members[0].uid).toBe(1);
        expect(members[0].status).toBe('joined');
        expect(members[0].role).toBe('admin');
    });

    it('should respect status', async () => {
        let repo = container.get<OrganizationRepository>('OrganizationRepository');
        let ctx = createNamedContext('test');
        let id = (await repo.createOrganization(ctx, 1, { name: 'title' }, { editorial: false, status: 'activated' })).id;
        let org = await Store.Organization.findById(ctx, id);
        expect(org).not.toBeNull();
        expect(org).not.toBeUndefined();
        expect(org!.status).toEqual('activated');

        let id2 = (await repo.createOrganization(ctx, 1, { name: 'title' }, { editorial: false, status: 'suspended' })).id;
        let org2 = await Store.Organization.findById(ctx, id2);
        expect(org2).not.toBeNull();
        expect(org2).not.toBeUndefined();
        expect(org2!.status).toEqual('suspended');

        let id3 = (await repo.createOrganization(ctx, 1, { name: 'title' }, { editorial: false, status: 'pending' })).id;
        let org3 = await Store.Organization.findById(ctx, id3);
        expect(org3).not.toBeNull();
        expect(org3).not.toBeUndefined();
        expect(org3!.status).toEqual('pending');
    });

    it('should delete organization', async () => {
        let repo = container.get<OrganizationRepository>('OrganizationRepository');
        let userRepo = container.get<UserRepository>('UserRepository');

        let ctx = createNamedContext('test');

        let user = await createUser(ctx, 1);

        let id = (await repo.createOrganization(ctx, user.id, { name: 'title' }, { editorial: false, status: 'activated' })).id;
        (await repo.createOrganization(ctx, user.id, { name: 'title2' }, { editorial: false, status: 'activated' })).id;

        let org = await Store.Organization.findById(ctx, id);
        expect(org).not.toBeNull();
        expect(org).not.toBeUndefined();
        expect(org!.status).toEqual('activated');

        await repo.deleteOrganization(ctx, user.id, id);

        org = await Store.Organization.findById(ctx, id);
        expect(org!.status).toEqual('deleted');

        let profile = await userRepo.findUserProfile(ctx, user.id);
        expect(profile!.primaryOrganization).not.toEqual(id);
    });
});
