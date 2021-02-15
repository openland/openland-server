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
import { inReadOnlyTx } from '@openland/foundationdb';

let rootCtx = createNamedContext('test');

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
        // Create Test User
        let user = await Modules.Users.createUser(rootCtx, { email: 'some@email.comn' });
        let profile = await Modules.Users.createUserProfile(rootCtx, user.id, { firstName: 'Some Name' });

        // Assert default user status
        expect(user.status).toEqual('activated');
        expect(profile.primaryOrganization).toBeNull();

        // Create Organization
        let res = await Modules.Orgs.createOrganization(rootCtx, user.id, { name: 'hey' });

        // Validate organization
        let org = await inReadOnlyTx(rootCtx, async (ctx) => (await Store.Organization.findById(ctx, res.id))!);
        expect(org).not.toBeUndefined();
        expect(org).not.toBeNull();
        expect(org.status).toEqual('activated');
        expect(org.ownerId).toBe(user.id);

        // Validate membership
        let membership = await inReadOnlyTx(rootCtx, async (ctx) => (await Modules.Orgs.findUserMembership(ctx, user.id, org.id))!);
        expect(membership).not.toBeUndefined();
        expect(membership).not.toBeNull();
        expect(membership.invitedBy).toBe(user.id);
        expect(membership.status).toEqual('joined');
        expect(membership.role).toEqual('admin');

        // Should NOT update primary organization since organization is not activated yet
        let profile2 = await inReadOnlyTx(rootCtx, async (ctx) => (await Store.UserProfile.findById(ctx, user.id))!);
        expect(profile2.primaryOrganization).toBe(org.id);
    }, 50000);

    it('should activate organization for activated user', async () => {
        let user = await Modules.Users.createUser(rootCtx, { email: 'som2@email.comn' });
        await Modules.Users.createUserProfile(rootCtx, user.id, { firstName: 'Some Name' });
        let org1 = await Modules.Orgs.createOrganization(rootCtx, user.id, { name: 'hey' });
        await Modules.Orgs.createOrganization(rootCtx, user.id, { name: 'hey' });
        let profile2 = await inReadOnlyTx(rootCtx, async (ctx) => (await Store.UserProfile.findById(ctx, user.id))!);
        expect(profile2.primaryOrganization).toBe(org1.id);
    }, 50000);

    it('should select primary organization from first activated', async () => {
        let user = await Modules.Users.createUser(rootCtx, { email: 'some2@email.comn' });
        await Modules.Users.createUserProfile(rootCtx, user.id, { firstName: 'Some Name' });
        // await Modules.Users.activateUser(user.id);

        let org1 = await Modules.Orgs.createOrganization(rootCtx, user.id, { name: 'hey' });
        // @ts-ignore
        let org2 = await Modules.Orgs.createOrganization(rootCtx, user.id, { name: 'hey' });
        // @ts-ignore
        let org3 = await Modules.Orgs.createOrganization(rootCtx, user.id, { name: 'hey' });
        // await Modules.Orgs.activateOrganization(ctx, org2.id, true);
        // await Modules.Orgs.activateOrganization(ctx, org1.id, true);
        // await Modules.Orgs.activateOrganization(ctx, org3.id, true);

        let profile2 = await inReadOnlyTx(rootCtx, async (ctx) => (await Store.UserProfile.findById(ctx, user.id))!);
        expect(profile2.primaryOrganization).toBe(org1.id);
    }, 50000);

    it('should not activate deleted organization', async () => {
        // Create User and Org
        let user = await Modules.Users.createUser(rootCtx, { email: 'some____3@email.comn' });
        await Modules.Users.createUserProfile(rootCtx, user.id, { firstName: 'Some Name' });

        // Create Organization
        let org = await Modules.Orgs.createOrganization(rootCtx, user.id, { name: 'hey' });
        // create second org, because we can't delete our last organization
        await Modules.Orgs.createOrganization(rootCtx, user.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(rootCtx, user.id, org.id, user.id);
        await Modules.Orgs.activateOrganization(rootCtx, org.id, true);
        await Modules.Orgs.deleteOrganization(rootCtx, user.id, org.id);
        await Modules.Orgs.activateOrganization(rootCtx, org.id, true);
        org = await inReadOnlyTx(rootCtx, async (ctx) => (await Store.Organization.findById(ctx, org.id))!);

        expect(org.status).toEqual('deleted');
    }, 50000);

    it('should suspend organization and DO NOT suspend user', async () => {
        // Create User and Org
        let user = await Modules.Users.createUser(rootCtx, { email: 'some5@email.comn' });
        await Modules.Users.createUserProfile(rootCtx, user.id, { firstName: 'Some Name' });
        user = await inReadOnlyTx(rootCtx, async (ctx) => (await Store.User.findById(ctx, user.id))!);
        expect(user.status).toEqual('activated');

        // Create organization
        let org = await Modules.Orgs.createOrganization(rootCtx, user.id, { name: 'hey' });
        expect(org.status).toEqual('activated');

        // Deactivate organization
        await Modules.Orgs.suspendOrganization(rootCtx, org.id);
        let org2 = await inReadOnlyTx(rootCtx, async (ctx) => (await Store.Organization.findById(ctx, org.id))!);
        expect(org2.status).toEqual('suspended');

        // Check user status
        let user4 = await inReadOnlyTx(rootCtx, async (ctx) => (await Store.User.findById(ctx, user.id))!);
        expect(user4.status).toEqual('activated');
    }, 50000);

    it('should not remove user from organization if it is last organization for user', async () => {
        let user1 = await createUser(rootCtx, 6);
        let user2 = await createUser(rootCtx, 7);
        let org = await Modules.Orgs.createOrganization(rootCtx, user1.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(rootCtx, user2.id, org.id, user1.id);

        // Disallow kicking admin by non-admin
        await expect(Modules.Orgs.removeUserFromOrganization(rootCtx, user2.id, org.id, user2.id)).rejects.toThrowError();
    }, 50000);

    it('should return correct membership status for users', async () => {
        let user1 = await createUser(rootCtx, 10);
        let user2 = await createUser(rootCtx, 11);
        let user3 = await createUser(rootCtx, 12);
        let user4 = await createUser(rootCtx, 14);
        let initialOrganization = await Modules.Orgs.createOrganization(rootCtx, user1.id, { name: 'initialOrganization' });
        let org = await Modules.Orgs.createOrganization(rootCtx, user1.id, { name: 'hey' });

        await Modules.Orgs.addUserToOrganization(rootCtx, user2.id, initialOrganization.id, user1.id);
        await Modules.Orgs.addUserToOrganization(rootCtx, user2.id, org.id, user1.id);
        await Modules.Orgs.addUserToOrganization(rootCtx, user4.id, initialOrganization.id, user1.id);
        await Modules.Orgs.addUserToOrganization(rootCtx, user4.id, org.id, user1.id);
        await Modules.Orgs.updateMemberRole(rootCtx, user4.id, org.id, 'admin', user1.id);

        await inReadOnlyTx(rootCtx, async (ctx) => {
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
        });

        await Modules.Orgs.removeUserFromOrganization(rootCtx, user2.id, org.id, user1.id);
        await Modules.Orgs.removeUserFromOrganization(rootCtx, user4.id, org.id, user1.id);

        await inReadOnlyTx(rootCtx, async (ctx) => {
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
        });
    }, 50000);

    it('should downgrade membership on organization left', async () => {
        let user1 = await createUser(rootCtx, 15);
        let user2 = await createUser(rootCtx, 16);
        let user3 = await createUser(rootCtx, 17);
        let initialOrganization = await Modules.Orgs.createOrganization(rootCtx, user1.id, { name: 'initialOrganization' });
        let org = await Modules.Orgs.createOrganization(rootCtx, user1.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(rootCtx, user2.id, initialOrganization.id, user1.id);
        await Modules.Orgs.addUserToOrganization(rootCtx, user2.id, org.id, user1.id);
        await Modules.Orgs.addUserToOrganization(rootCtx, user3.id, initialOrganization.id, user1.id);
        await Modules.Orgs.addUserToOrganization(rootCtx, user3.id, org.id, user1.id);
        await Modules.Orgs.updateMemberRole(rootCtx, user3.id, org.id, 'admin', user1.id);
        await Modules.Orgs.removeUserFromOrganization(rootCtx, user3.id, org.id, user1.id);

        await Modules.Orgs.addUserToOrganization(rootCtx, user3.id, org.id, user1.id);

        await inReadOnlyTx(rootCtx, async (ctx) => {
            expect(await Modules.Orgs.isUserOwner(ctx, user3.id, org.id)).toBe(false);
            expect(await Modules.Orgs.isUserMember(ctx, user3.id, org.id)).toBe(true);
            expect(await Modules.Orgs.isUserAdmin(ctx, user3.id, org.id)).toBe(false);
        });
    }, 50000);

    it('should allow role changing only to owners', async () => {
        let user1 = await createUser(rootCtx, 18);
        let user2 = await createUser(rootCtx, 19);
        let user3 = await createUser(rootCtx, 20);
        let user4 = await createUser(rootCtx, 21);
        let org = await Modules.Orgs.createOrganization(rootCtx, user1.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(rootCtx, user2.id, org.id, user1.id);
        await Modules.Orgs.addUserToOrganization(rootCtx, user3.id, org.id, user1.id);
        await Modules.Orgs.updateMemberRole(rootCtx, user3.id, org.id, 'admin', user1.id);

        // Disallow changing owner role
        await expect(Modules.Orgs.updateMemberRole(rootCtx, user1.id, org.id, 'member', user1.id)).rejects.toThrowError();

        // Disallow non-admin members to change roles
        await expect(Modules.Orgs.updateMemberRole(rootCtx, user3.id, org.id, 'member', user2.id)).rejects.toThrowError();

        // Disallow role changes for foreign members
        await expect(Modules.Orgs.updateMemberRole(rootCtx, user2.id, org.id, 'member', user4.id)).rejects.toThrowError();

        // Throw error when trying to edit role for non-member
        await expect(Modules.Orgs.updateMemberRole(rootCtx, user4.id, org.id, 'member', user1.id)).rejects.toThrowError();
    }, 50000);

    it('should handle kicking securely', async () => {
        let user1 = await createUser(rootCtx, 22);
        let user2 = await createUser(rootCtx, 23);
        let user3 = await createUser(rootCtx, 24);
        let user4 = await createUser(rootCtx, 25);
        let initialOrganization = await Modules.Orgs.createOrganization(rootCtx, user1.id, { name: 'initialOrganization' });
        let org = await Modules.Orgs.createOrganization(rootCtx, user1.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(rootCtx, user2.id, initialOrganization.id, user1.id);
        await Modules.Orgs.addUserToOrganization(rootCtx, user2.id, org.id, user1.id);
        await Modules.Orgs.addUserToOrganization(rootCtx, user3.id, initialOrganization.id, user2.id);
        await Modules.Orgs.addUserToOrganization(rootCtx, user3.id, org.id, user2.id);
        await Modules.Orgs.addUserToOrganization(rootCtx, user4.id, initialOrganization.id, user1.id);
        await Modules.Orgs.addUserToOrganization(rootCtx, user4.id, org.id, user1.id);
        await Modules.Orgs.updateMemberRole(rootCtx, user3.id, org.id, 'admin', user1.id);

        // Disallow kicking owner
        await expect(Modules.Orgs.removeUserFromOrganization(rootCtx, user1.id, org.id, user1.id)).rejects.toThrowError();

        // Disallow kicking admin by non-admin
        await expect(Modules.Orgs.removeUserFromOrganization(rootCtx, user3.id, org.id, user2.id)).rejects.toThrowError();

        // Disallow kicking by non-admin and non-inviter
        await expect(Modules.Orgs.removeUserFromOrganization(rootCtx, user3.id, org.id, user2.id)).rejects.toThrowError();

        // Should remove admin by owner
        expect(await Modules.Orgs.removeUserFromOrganization(rootCtx, user3.id, org.id, user1.id)).toBe(true);

        // Should handle double kick gracefully
        expect(await Modules.Orgs.removeUserFromOrganization(rootCtx, user3.id, org.id, user1.id)).toBe(false);
    }, 50000);
});
