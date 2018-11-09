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

    async function createUser(index: number) {
        let user = await Modules.Users.createUser('test' + index, index + 'some@email.comn');
        await Modules.Users.createUserProfile(user.id, { firstName: 'Some Name' });
        return user;
    }

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

        // Validate membership
        let membership = (await Modules.Orgs.findUserMembership(user.id, org.id))!;
        expect(membership).not.toBeUndefined();
        expect(membership).not.toBeNull();
        expect(membership.invitedBy).toBe(user.id);
        expect(membership.status).toEqual('joined');
        expect(membership.role).toEqual('admin');

        // Should NOT update primary organization since organization is not activated yet
        let profile2 = (await FDB.UserProfile.findById(user.id))!;
        expect(profile2.primaryOrganization).toBeNull();
    });

    it('should activate organization for activated user', async () => {
        let user = await Modules.Users.createUser('tes2', 'som2@email.comn');
        await Modules.Users.createUserProfile(user.id, { firstName: 'Some Name' });
        await Modules.Users.activateUser(user.id);
        let org1 = await Modules.Orgs.createOrganization(user.id, { name: 'hey' });
        await Modules.Orgs.createOrganization(user.id, { name: 'hey' });
        let profile2 = (await FDB.UserProfile.findById(user.id))!;
        expect(profile2.primaryOrganization).toBe(org1.id);
    });

    it('should select primary organization from first activated', async () => {
        let user = await Modules.Users.createUser('test2', 'some2@email.comn');
        await Modules.Users.createUserProfile(user.id, { firstName: 'Some Name' });
        // await Modules.Users.activateUser(user.id);

        let org1 = await Modules.Orgs.createOrganization(user.id, { name: 'hey' });
        let org2 = await Modules.Orgs.createOrganization(user.id, { name: 'hey' });
        let org3 = await Modules.Orgs.createOrganization(user.id, { name: 'hey' });
        await Modules.Orgs.activateOrganization(org2.id);
        await Modules.Orgs.activateOrganization(org1.id);
        await Modules.Orgs.activateOrganization(org3.id);

        let profile2 = (await FDB.UserProfile.findById(user.id))!;
        expect(profile2.primaryOrganization).toBe(org2.id);
    });

    it('should activate user on organization activation', async () => {
        // Create User and Org
        let user = await Modules.Users.createUser('test3', 'some3@email.comn');
        await Modules.Users.createUserProfile(user.id, { firstName: 'Some Name' });
        let userp = (await FDB.UserProfile.findById(user.id))!;
        expect(userp.primaryOrganization).toBeNull();
        let user2 = await Modules.Users.createUser('test4', 'some4@email.comn');
        await Modules.Users.createUserProfile(user2.id, { firstName: 'Some Name' });
        let user2p = (await FDB.UserProfile.findById(user2.id))!;
        expect(user2p.primaryOrganization).toBeNull();

        // Create Organization
        let org = await Modules.Orgs.createOrganization(user.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(user2.id, org.id, user.id);

        // Activate Org
        await Modules.Orgs.activateOrganization(org.id);

        // Check users status
        let user4 = (await FDB.User.findById(user.id))!;
        let user4p = (await FDB.UserProfile.findById(user.id))!;
        expect(user4.status).toEqual('activated');
        expect(user4p.primaryOrganization).toEqual(org.id);
        let user5 = (await FDB.User.findById(user2.id))!;
        let user5p = (await FDB.UserProfile.findById(user2.id))!;
        expect(user5.status).toEqual('activated');
        expect(user5p.primaryOrganization).toEqual(org.id);
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

    it('should activate user on joining to activated organization', async () => {

        // Create Owner and Org
        let user = await Modules.Users.createUser('test6', 'some6@email.comn');
        await Modules.Users.createUserProfile(user.id, { firstName: 'Some Name' });
        await Modules.Users.activateUser(user.id);
        user = (await FDB.User.findById(user.id))!;
        expect(user.status).toEqual('activated');
        let org = await Modules.Orgs.createOrganization(user.id, { name: 'hey' });
        expect(org.status).toEqual('activated');

        // Add user
        let user2 = await Modules.Users.createUser('test7', 'some7@email.com');
        await Modules.Users.createUserProfile(user2.id, { firstName: 'Some Name' });
        await Modules.Orgs.addUserToOrganization(user2.id, org.id, user.id);
        user2 = (await FDB.User.findById(user2.id))!;
        let user2p = (await FDB.UserProfile.findById(user2.id))!;
        expect(user2.status).toEqual('activated');
        expect(user2p.primaryOrganization).toEqual(org.id);
    });

    it('should remove primary organization when removing from the only organization', async () => {
        let user1 = await createUser(6);
        let user2 = await createUser(7);
        await Modules.Users.activateUser(user1.id);
        await Modules.Users.activateUser(user2.id);
        let org = await Modules.Orgs.createOrganization(user1.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(user2.id, org.id, user1.id);
        let user1p = (await FDB.UserProfile.findById(user1.id))!;
        let user2p = (await FDB.UserProfile.findById(user2.id))!;
        expect(user1p.primaryOrganization).toEqual(org.id);
        expect(user2p.primaryOrganization).toEqual(org.id);

        await Modules.Orgs.removeUserFromOrganization(user2.id, org.id, user1.id);

        user1p = (await FDB.UserProfile.findById(user1.id))!;
        user2p = (await FDB.UserProfile.findById(user2.id))!;
        expect(user1p.primaryOrganization).toEqual(org.id);
        expect(user2p.primaryOrganization).toBeNull();
    });

    it('should pick another primary organization when removing primary one', async () => {
        let user1 = await createUser(8);
        let user2 = await createUser(9);
        await Modules.Users.activateUser(user1.id);
        await Modules.Users.activateUser(user2.id);
        let org = await Modules.Orgs.createOrganization(user1.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(user2.id, org.id, user1.id);
        let org2 = await Modules.Orgs.createOrganization(user1.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(user2.id, org2.id, user1.id);
        let user1p = (await FDB.UserProfile.findById(user1.id))!;
        let user2p = (await FDB.UserProfile.findById(user2.id))!;
        expect(user1p.primaryOrganization).toEqual(org.id);
        expect(user2p.primaryOrganization).toEqual(org.id);

        await Modules.Orgs.removeUserFromOrganization(user2.id, org.id, user1.id);

        user1p = (await FDB.UserProfile.findById(user1.id))!;
        user2p = (await FDB.UserProfile.findById(user2.id))!;
        expect(user1p.primaryOrganization).toEqual(org.id);
        expect(user2p.primaryOrganization).toEqual(org2.id);
    });

    it('should return correct membership status for users', async () => {
        let user1 = await createUser(10);
        let user2 = await createUser(11);
        let user3 = await createUser(12);
        let user4 = await createUser(14);
        await Modules.Users.activateUser(user1.id);
        await Modules.Users.activateUser(user2.id);
        await Modules.Users.activateUser(user3.id);
        await Modules.Users.activateUser(user4.id);
        let org = await Modules.Orgs.createOrganization(user1.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(user2.id, org.id, user1.id);
        await Modules.Orgs.addUserToOrganization(user4.id, org.id, user1.id);
        await Modules.Orgs.updateMemberRole(user4.id, org.id, 'admin', user1.id);

        expect(await Modules.Orgs.isUserOwner(user1.id, org.id)).toBe(true);
        expect(await Modules.Orgs.isUserOwner(user2.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserOwner(user3.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserOwner(user4.id, org.id)).toBe(false);

        expect(await Modules.Orgs.isUserMember(user1.id, org.id)).toBe(true);
        expect(await Modules.Orgs.isUserMember(user2.id, org.id)).toBe(true);
        expect(await Modules.Orgs.isUserMember(user3.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserMember(user4.id, org.id)).toBe(true);

        expect(await Modules.Orgs.isUserAdmin(user1.id, org.id)).toBe(true);
        expect(await Modules.Orgs.isUserAdmin(user2.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserAdmin(user3.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserAdmin(user4.id, org.id)).toBe(true);

        await Modules.Orgs.removeUserFromOrganization(user2.id, org.id, user1.id);
        await Modules.Orgs.removeUserFromOrganization(user4.id, org.id, user1.id);

        expect(await Modules.Orgs.isUserOwner(user1.id, org.id)).toBe(true);
        expect(await Modules.Orgs.isUserOwner(user2.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserOwner(user3.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserOwner(user4.id, org.id)).toBe(false);

        expect(await Modules.Orgs.isUserMember(user1.id, org.id)).toBe(true);
        expect(await Modules.Orgs.isUserMember(user2.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserMember(user3.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserMember(user4.id, org.id)).toBe(false);

        expect(await Modules.Orgs.isUserAdmin(user1.id, org.id)).toBe(true);
        expect(await Modules.Orgs.isUserAdmin(user2.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserAdmin(user3.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserAdmin(user4.id, org.id)).toBe(false);
    });

    it('should downgrade membership on organization left', async () => {
        let user1 = await createUser(15);
        let user2 = await createUser(16);
        let user3 = await createUser(17);
        await Modules.Users.activateUser(user1.id);
        await Modules.Users.activateUser(user2.id);
        await Modules.Users.activateUser(user3.id);
        let org = await Modules.Orgs.createOrganization(user1.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(user2.id, org.id, user1.id);
        await Modules.Orgs.addUserToOrganization(user3.id, org.id, user1.id);
        await Modules.Orgs.updateMemberRole(user3.id, org.id, 'admin', user1.id);
        await Modules.Orgs.removeUserFromOrganization(user3.id, org.id, user1.id);
        await Modules.Orgs.addUserToOrganization(user3.id, org.id, user1.id);

        expect(await Modules.Orgs.isUserOwner(user3.id, org.id)).toBe(false);
        expect(await Modules.Orgs.isUserMember(user3.id, org.id)).toBe(true);
        expect(await Modules.Orgs.isUserAdmin(user3.id, org.id)).toBe(false);
    });

    it('should allow role changing only to owners', async () => {
        let user1 = await createUser(18);
        let user2 = await createUser(19);
        let user3 = await createUser(20);
        let user4 = await createUser(20);
        await Modules.Users.activateUser(user1.id);
        await Modules.Users.activateUser(user2.id);
        await Modules.Users.activateUser(user3.id);
        let org = await Modules.Orgs.createOrganization(user1.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(user2.id, org.id, user1.id);
        await Modules.Orgs.addUserToOrganization(user3.id, org.id, user1.id);
        await Modules.Orgs.updateMemberRole(user3.id, org.id, 'admin', user1.id);

        // Disallow changing owner role
        await expect(Modules.Orgs.updateMemberRole(user1.id, org.id, 'member', user1.id)).rejects.toThrowError();

        // Disallow non-admin members to change roles
        await expect(Modules.Orgs.updateMemberRole(user3.id, org.id, 'member', user2.id)).rejects.toThrowError();

        // Disallow role changes for foreign members
        await expect(Modules.Orgs.updateMemberRole(user2.id, org.id, 'member', user4.id)).rejects.toThrowError();

        // Throw error when trying to edit role for non-member
        await expect(Modules.Orgs.updateMemberRole(user4.id, org.id, 'member', user1.id)).rejects.toThrowError();
    });

    it('should handle kicking securely', async () => {
        let user1 = await createUser(21);
        let user2 = await createUser(22);
        let user3 = await createUser(23);
        let user4 = await createUser(24);
        await Modules.Users.activateUser(user1.id);
        await Modules.Users.activateUser(user2.id);
        await Modules.Users.activateUser(user3.id);
        let org = await Modules.Orgs.createOrganization(user1.id, { name: 'hey' });
        await Modules.Orgs.addUserToOrganization(user2.id, org.id, user1.id);
        await Modules.Orgs.addUserToOrganization(user3.id, org.id, user2.id);
        await Modules.Orgs.addUserToOrganization(user4.id, org.id, user1.id);
        await Modules.Orgs.updateMemberRole(user3.id, org.id, 'admin', user1.id);

        // Disallow kicking owner
        await expect(Modules.Orgs.removeUserFromOrganization(user1.id, org.id, user1.id)).rejects.toThrowError();

        // Disallow kicking admin by non-admin
        await expect(Modules.Orgs.removeUserFromOrganization(user3.id, org.id, user2.id)).rejects.toThrowError();

        // Disallow kicking by non-admin and non-inviter
        await expect(Modules.Orgs.removeUserFromOrganization(user3.id, org.id, user2.id)).rejects.toThrowError();

        // Should remove admin by owner
        expect(await Modules.Orgs.removeUserFromOrganization(user3.id, org.id, user1.id)).toBe(true);
        
        // Should handle double kick gracefully
        expect(await Modules.Orgs.removeUserFromOrganization(user3.id, org.id, user1.id)).toBe(false);
    });
});