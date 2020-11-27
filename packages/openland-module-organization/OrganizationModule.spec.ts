import 'reflect-metadata';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { Modules } from 'openland-modules/Modules';
import { container } from 'openland-modules/Modules.container';
import { OrganizationModule } from './OrganizationModule';
import { OrganizationRepository } from './repositories/OrganizationRepository';
import { UsersModule } from 'openland-module-users/UsersModule';
import { SuperModule } from 'openland-module-super/SuperModule';
import { HooksModule } from 'openland-module-hooks/HooksModule';
import { Store } from 'openland-module-db/FDB';
import { Context, createNamedContext } from '@openland/context';
import { loadUsersModule } from '../openland-module-users/UsersModule.container';
import { ShortnameModule } from '../openland-module-shortname/ShortnameModule';
import { loadShortnameModule } from '../openland-module-shortname/ShortnameModule.container';

describe('OrganizationModule', () => {
    beforeAll(async () => {
        // let start = Date.now();
        await testEnvironmentStart('orgs');
        container.bind('OrganizationRepository').to(OrganizationRepository).inSingletonScope();
        container.bind(OrganizationModule).toSelf().inSingletonScope();
        container.bind(UsersModule).toSelf().inSingletonScope();
        loadUsersModule();
        container.bind(SuperModule).toSelf().inSingletonScope();
        container.bind(HooksModule).toSelf().inSingletonScope();
        container.bind(ShortnameModule).toSelf().inSingletonScope();
        loadShortnameModule();
        // console.log('loaded in ' + (Date.now() - start) + ' ms');
    }, 50000);
    afterAll(async () => {
        await testEnvironmentEnd();
    }, 50000);

    async function createUser(ctx: Context, index: number) {
        let user = await Modules.Users.createUser(ctx, { email: index + 'some@email.comn' });
        await Modules.Users.createUserProfile(ctx, user.id, { firstName: 'Some Name' });
        return user;
    }

    it('should create organization', async () => {
        let ctx = createNamedContext('test');

        // Create Test User
        let user = await Modules.Users.createUser(ctx, { email: 'some@email.comn' });
        let profile = await Modules.Users.createUserProfile(ctx, user.id, { firstName: 'Some Name' });

        // Assert default user status
        expect(user.status).toEqual('activated');
        expect(profile.primaryOrganization).toBeNull();

        // Create Organization
        let res = await Modules.Orgs.createOrganization(ctx, user.id, { name: 'hey' });

        // Validate organization
        let org = (await Store.Organization.findById(ctx, res.id))!;
        expect(org).not.toBeUndefined();
        expect(org).not.toBeNull();
        expect(org.status).toEqual('activated');
        expect(org.ownerId).toBe(user.id);

        // Validate membership
        let membership = (await Modules.Orgs.findUserMembership(ctx, user.id, org.id))!;
        expect(membership).not.toBeUndefined();
        expect(membership).not.toBeNull();
        expect(membership.invitedBy).toBe(user.id);
        expect(membership.status).toEqual('joined');
        expect(membership.role).toEqual('admin');

        // Should NOT update primary organization since organization is not activated yet
        let profile2 = (await Store.UserProfile.findById(ctx, user.id))!;
        expect(profile2.primaryOrganization).toBe(org.id);
    }, 50000);

    it('should activate organization for activated user', async () => {
        let ctx = createNamedContext('test');
        let user = await Modules.Users.createUser(ctx, { email: 'som2@email.comn' });
        await Modules.Users.createUserProfile(ctx, user.id, { firstName: 'Some Name' });
        let org1 = await Modules.Orgs.createOrganization(ctx, user.id, { name: 'hey' });
        await Modules.Orgs.createOrganization(ctx, user.id, { name: 'hey' });
        let profile2 = (await Store.UserProfile.findById(ctx, user.id))!;
        expect(profile2.primaryOrganization).toBe(org1.id);
    }, 50000);

    it('should select primary organization from first activated', async () => {
        let ctx = createNamedContext('test');
        let user = await Modules.Users.createUser(ctx, { email: 'some2@email.comn' });
        await Modules.Users.createUserProfile(ctx, user.id, { firstName: 'Some Name' });
        // await Modules.Users.activateUser(user.id);

        let org1 = await Modules.Orgs.createOrganization(ctx, user.id, { name: 'hey' });
        // @ts-ignore
        let org2 = await Modules.Orgs.createOrganization(ctx, user.id, { name: 'hey' });
        // @ts-ignore
        let org3 = await Modules.Orgs.createOrganization(ctx, user.id, { name: 'hey' });
        // await Modules.Orgs.activateOrganization(ctx, org2.id, true);
        // await Modules.Orgs.activateOrganization(ctx, org1.id, true);
        // await Modules.Orgs.activateOrganization(ctx, org3.id, true);

        let profile2 = (await Store.UserProfile.findById(ctx, user.id))!;
        expect(profile2.primaryOrganization).toBe(org1.id);
    }, 50000);

    it('should not activate deleted organization', async () => {
        let ctx = createNamedContext('test');

        // Create User and Org
        let user = await Modules.Users.createUser(ctx, { email: 'some____3@email.comn' });
        await Modules.Users.createUserProfile(ctx, user.id, { firstName: 'Some Name' });

        // Create Organization
        let org = await Modules.Orgs.createOrganization(ctx, user.id, { name: 'hey' });
        // create second org, because we can't delete our last organization
        await Modules.Orgs.createOrganization(ctx, user.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(ctx, user.id, org.id, user.id);
        await Modules.Orgs.activateOrganization(ctx, org.id, true);
        await Modules.Orgs.deleteOrganization(ctx, user.id, org.id);
        await Modules.Orgs.activateOrganization(ctx, org.id, true);
        org = (await Store.Organization.findById(ctx, org.id))!;

        expect(org.status).toEqual('deleted');
    }, 50000);

    it('should suspend organization and DO NOT suspend user', async () => {
        let ctx = createNamedContext('test');

        // Create User and Org
        let user = await Modules.Users.createUser(ctx, { email: 'some5@email.comn' });
        await Modules.Users.createUserProfile(ctx, user.id, { firstName: 'Some Name' });
        user = (await Store.User.findById(ctx, user.id))!;
        expect(user.status).toEqual('activated');

        // Create organization
        let org = await Modules.Orgs.createOrganization(ctx, user.id, { name: 'hey' });
        expect(org.status).toEqual('activated');

        // Deactivate organization
        await Modules.Orgs.suspendOrganization(ctx, org.id);
        let org2 = (await Store.Organization.findById(ctx, org.id))!;
        expect(org2.status).toEqual('suspended');

        // Check user status
        let user4 = (await Store.User.findById(ctx, user.id))!;
        expect(user4.status).toEqual('activated');
    }, 50000);

    it('should not remove user from organization if it is last organization for user', async () => {
        let ctx = createNamedContext('test');
        let user1 = await createUser(ctx, 6);
        let user2 = await createUser(ctx, 7);
        let org = await Modules.Orgs.createOrganization(ctx, user1.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(ctx, user2.id, org.id, user1.id);

        // Disallow kicking admin by non-admin
        await expect(Modules.Orgs.removeUserFromOrganization(ctx, user2.id, org.id, user2.id)).rejects.toThrowError();
    }, 50000);

    it('should return correct membership status for users', async () => {
        let ctx = createNamedContext('test');
        let user1 = await createUser(ctx, 10);
        let user2 = await createUser(ctx, 11);
        let user3 = await createUser(ctx, 12);
        let user4 = await createUser(ctx, 14);
        let initialOrganization = await Modules.Orgs.createOrganization(ctx, user1.id, { name: 'initialOrganization' });
        let org = await Modules.Orgs.createOrganization(ctx, user1.id, { name: 'hey' });

        await Modules.Orgs.addUserToOrganization(ctx, user2.id, initialOrganization.id, user1.id);
        await Modules.Orgs.addUserToOrganization(ctx, user2.id, org.id, user1.id);
        await Modules.Orgs.addUserToOrganization(ctx, user4.id, initialOrganization.id, user1.id);
        await Modules.Orgs.addUserToOrganization(ctx, user4.id, org.id, user1.id);
        await Modules.Orgs.updateMemberRole(ctx, user4.id, org.id, 'admin', user1.id);

        expect(await Modules.Orgs.isUserOwner(ctx, user1.id, org.id)).toBe(true);
        expect(await Modules.Orgs.isUserOwner(ctx, user2.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserOwner(ctx, user3.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserOwner(ctx, user4.id, org.id)).toBe(false);

        expect(await Modules.Orgs.isUserMember(ctx, user1.id, org.id)).toBe(true);
        expect(await Modules.Orgs.isUserMember(ctx, user2.id, org.id)).toBe(true);
        expect(await Modules.Orgs.isUserMember(ctx, user3.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserMember(ctx, user4.id, org.id)).toBe(true);

        expect(await Modules.Orgs.isUserAdmin(ctx, user1.id, org.id)).toBe(true);
        expect(await Modules.Orgs.isUserAdmin(ctx, user2.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserAdmin(ctx, user3.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserAdmin(ctx, user4.id, org.id)).toBe(true);

        await Modules.Orgs.removeUserFromOrganization(ctx, user2.id, org.id, user1.id);
        await Modules.Orgs.removeUserFromOrganization(ctx, user4.id, org.id, user1.id);

        expect(await Modules.Orgs.isUserOwner(ctx, user1.id, org.id)).toBe(true);
        expect(await Modules.Orgs.isUserOwner(ctx, user2.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserOwner(ctx, user3.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserOwner(ctx, user4.id, org.id)).toBe(false);

        expect(await Modules.Orgs.isUserMember(ctx, user1.id, org.id)).toBe(true);
        expect(await Modules.Orgs.isUserMember(ctx, user2.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserMember(ctx, user3.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserMember(ctx, user4.id, org.id)).toBe(false);

        expect(await Modules.Orgs.isUserAdmin(ctx, user1.id, org.id)).toBe(true);
        expect(await Modules.Orgs.isUserAdmin(ctx, user2.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserAdmin(ctx, user3.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserAdmin(ctx, user4.id, org.id)).toBe(false);
    }, 50000);

    it('should downgrade membership on organization left', async () => {
        let ctx = createNamedContext('test');
        let user1 = await createUser(ctx, 15);
        let user2 = await createUser(ctx, 16);
        let user3 = await createUser(ctx, 17);
        let initialOrganization = await Modules.Orgs.createOrganization(ctx, user1.id, { name: 'initialOrganization' });
        let org = await Modules.Orgs.createOrganization(ctx, user1.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(ctx, user2.id, initialOrganization.id, user1.id);
        await Modules.Orgs.addUserToOrganization(ctx, user2.id, org.id, user1.id);
        await Modules.Orgs.addUserToOrganization(ctx, user3.id, initialOrganization.id, user1.id);
        await Modules.Orgs.addUserToOrganization(ctx, user3.id, org.id, user1.id);
        await Modules.Orgs.updateMemberRole(ctx, user3.id, org.id, 'admin', user1.id);
        await Modules.Orgs.removeUserFromOrganization(ctx, user3.id, org.id, user1.id);

        await Modules.Orgs.addUserToOrganization(ctx, user3.id, org.id, user1.id);

        expect(await Modules.Orgs.isUserOwner(ctx, user3.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserMember(ctx, user3.id, org.id)).toBe(true);
        expect(await Modules.Orgs.isUserAdmin(ctx, user3.id, org.id)).toBe(false);
    }, 50000);

    it('should allow role changing only to owners', async () => {
        let ctx = createNamedContext('test');
        let user1 = await createUser(ctx, 18);
        let user2 = await createUser(ctx, 19);
        let user3 = await createUser(ctx, 20);
        let user4 = await createUser(ctx, 21);
        let org = await Modules.Orgs.createOrganization(ctx, user1.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(ctx, user2.id, org.id, user1.id);
        await Modules.Orgs.addUserToOrganization(ctx, user3.id, org.id, user1.id);
        await Modules.Orgs.updateMemberRole(ctx, user3.id, org.id, 'admin', user1.id);

        // Disallow changing owner role
        await expect(Modules.Orgs.updateMemberRole(ctx, user1.id, org.id, 'member', user1.id)).rejects.toThrowError();

        // Disallow non-admin members to change roles
        await expect(Modules.Orgs.updateMemberRole(ctx, user3.id, org.id, 'member', user2.id)).rejects.toThrowError();

        // Disallow role changes for foreign members
        await expect(Modules.Orgs.updateMemberRole(ctx, user2.id, org.id, 'member', user4.id)).rejects.toThrowError();

        // Throw error when trying to edit role for non-member
        await expect(Modules.Orgs.updateMemberRole(ctx, user4.id, org.id, 'member', user1.id)).rejects.toThrowError();
    }, 50000);

    it('should handle kicking securely', async () => {
        let ctx = createNamedContext('test');
        let user1 = await createUser(ctx, 22);
        let user2 = await createUser(ctx, 23);
        let user3 = await createUser(ctx, 24);
        let user4 = await createUser(ctx, 25);
        let initialOrganization = await Modules.Orgs.createOrganization(ctx, user1.id, { name: 'initialOrganization' });
        let org = await Modules.Orgs.createOrganization(ctx, user1.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(ctx, user2.id, initialOrganization.id, user1.id);
        await Modules.Orgs.addUserToOrganization(ctx, user2.id, org.id, user1.id);
        await Modules.Orgs.addUserToOrganization(ctx, user3.id, initialOrganization.id, user2.id);
        await Modules.Orgs.addUserToOrganization(ctx, user3.id, org.id, user2.id);
        await Modules.Orgs.addUserToOrganization(ctx, user4.id, initialOrganization.id, user1.id);
        await Modules.Orgs.addUserToOrganization(ctx, user4.id, org.id, user1.id);
        await Modules.Orgs.updateMemberRole(ctx, user3.id, org.id, 'admin', user1.id);

        // Disallow kicking owner
        await expect(Modules.Orgs.removeUserFromOrganization(ctx, user1.id, org.id, user1.id)).rejects.toThrowError();

        // Disallow kicking admin by non-admin
        await expect(Modules.Orgs.removeUserFromOrganization(ctx, user3.id, org.id, user2.id)).rejects.toThrowError();

        // Disallow kicking by non-admin and non-inviter
        await expect(Modules.Orgs.removeUserFromOrganization(ctx, user3.id, org.id, user2.id)).rejects.toThrowError();

        // Should remove admin by owner
        expect(await Modules.Orgs.removeUserFromOrganization(ctx, user3.id, org.id, user1.id)).toBe(true);

        // Should handle double kick gracefully
        expect(await Modules.Orgs.removeUserFromOrganization(ctx, user3.id, org.id, user1.id)).toBe(false);
    }, 50000);
});
