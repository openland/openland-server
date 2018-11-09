import 'reflect-metadata';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { Modules } from 'openland-modules/Modules';
import { container } from 'openland-modules/Modules.container';
import { OrganizationModule } from './OrganizationModule';
import { OrganizationRepository } from './repositories/OrganizationRepository';
import { UsersModule } from 'openland-module-users/UsersModule';
import { SuperModule } from 'openland-module-super/SuperModule';
import { HooksModule } from 'openland-module-hooks/HooksModule';
import { FDB } from 'openland-module-db/FDB';
// console.log('imported in ' + (Date.now() - start) + ' ms');

describe('OrganizationModule', () => {
    beforeAll(async () => {
        // let start = Date.now();
        await testEnvironmentStart('orgs');
        container.bind(OrganizationRepository).toSelf().inSingletonScope();
        container.bind(OrganizationModule).toSelf().inSingletonScope();
        container.bind(UsersModule).toSelf().inSingletonScope();
        container.bind(SuperModule).toSelf().inSingletonScope();
        container.bind(HooksModule).toSelf().inSingletonScope();
        // console.log('loaded in ' + (Date.now() - start) + ' ms');
    });
    afterAll(() => {
        testEnvironmentEnd();
    });

    it('should create organization', async () => {

        // Create Test User
        let user = await Modules.Users.createUser('test1', 'some@email.comn');
        let profile = await Modules.Users.createUserProfile(user.id, { firstName: 'Some Name' });

        // Assert default user status
        expect(user.status).toEqual('pending');
        expect(profile.primaryOrganization).toBeNull();

        // Create Organization
        let res = await Modules.Orgs.createOrganization(user.id, { name: 'hey' });

        // Validate organization
        let org = (await FDB.Organization.findById(res.id))!;
        expect(org).not.toBeUndefined();
        expect(org).not.toBeNull();
        expect(org.status).toEqual('pending');
        expect(org.ownerId).toBe(user.id);

        // Should update primary organization
        let profile2 = (await FDB.UserProfile.findById(user.id))!;
        expect(profile2.primaryOrganization).toBe(org.id);
    });

    it('should NOT update primary organization', async () => {
        let user = await Modules.Users.createUser('test2', 'some2@email.comn');
        await Modules.Users.createUserProfile(user.id, { firstName: 'Some Name' });
        let org1 = await Modules.Orgs.createOrganization(user.id, { name: 'hey' });
        await Modules.Orgs.createOrganization(user.id, { name: 'hey' });

        let profile2 = (await FDB.UserProfile.findById(user.id))!;
        expect(profile2.primaryOrganization).toBe(org1.id);
    });

    it('should activate user on organization activation', async () => {
        // Create User and Org
        let user = await Modules.Users.createUser('test3', 'some3@email.comn');
        await Modules.Users.createUserProfile(user.id, { firstName: 'Some Name' });
        let user2 = await Modules.Users.createUser('test4', 'some4@email.comn');
        await Modules.Users.createUserProfile(user2.id, { firstName: 'Some Name' });

        // Create Organization
        let org = await Modules.Orgs.createOrganization(user.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(user2.id, org.id);

        // Activate Org
        await Modules.Orgs.activateOrganization(org.id);

        // Check users status
        let user4 = (await FDB.User.findById(user.id))!;
        expect(user4.status).toEqual('activated');
        let user5 = (await FDB.User.findById(user2.id))!;
        expect(user5.status).toEqual('activated');
    });

    it('should suspend organization and DO NOT suspend user', async () => {

        // Create User and Org
        let user = await Modules.Users.createUser('test5', 'some5@email.comn');
        await Modules.Users.createUserProfile(user.id, { firstName: 'Some Name' });
        await Modules.Users.activateUser(user.id);
        user = (await FDB.User.findById(user.id))!;
        expect(user.status).toEqual('activated');

        // Create organization
        let org = await Modules.Orgs.createOrganization(user.id, { name: 'hey' });
        expect(org.status).toEqual('activated');

        // Deactivate organization
        await Modules.Orgs.suspendOrganization(org.id);
        let org2 = (await FDB.Organization.findById(org.id))!;
        expect(org2.status).toEqual('suspended');

        // Check user status
        let user4 = (await FDB.User.findById(user.id))!;
        expect(user4.status).toEqual('activated');
    });
});