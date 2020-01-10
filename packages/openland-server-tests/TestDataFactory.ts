import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { uuid } from 'openland-utils/uuid';
import { Modules } from 'openland-modules/Modules';
import { injectable } from 'inversify';
import { User } from '../openland-module-db/store';

@injectable()
export default class TestDataFactory {
    async createSuperAdmin(parent: Context, email: string, firstName: string, lastName: string): Promise<User> {
        return await inTx(parent, async ctx => {
            let user = await Modules.Users.createUser(ctx, `user-${uuid()}`, email);
            await Modules.Users.createUserProfile(ctx, user.id, {
                firstName: firstName, lastName: lastName
            });
            await Modules.Users.activateUser(ctx, user.id, false, user.id);
            await Modules.Orgs.createOrganization(ctx, user.id, { name: `Openland` });
            await Modules.Super.makeSuperAdmin(ctx, user.id, 'super-admin');
            return user;
        });
    }

    async createTestUsers(parent: Context, count: number) {
        return await inTx(parent, async ctx => {
            let testUsers = [];
            for (let i = 1; i <= count; i++) {
                let testUser = await Modules.Users.createUser(ctx, `user-${uuid()}`, `test${uuid()}@maildu.de`);
                await Modules.Users.createUserProfile(ctx, testUser.id, {
                    firstName: 'Test', lastName: `${i}`
                });
                await Modules.Users.activateUser(ctx, testUser.id, false, testUser.id);
                await Modules.Orgs.createOrganization(ctx, testUser.id, { name: `Test organization ${i}` });
                testUsers.push(testUser);
            }
            return testUsers;
        });
    }

    async createTestChats(parent: Context, count: number, uids: number[]) {
        return await inTx(parent, async ctx => {
            if (uids.length < 1) {
                throw new Error('Members count is lower than 1');
            }
            let testCommunity = await Modules.Orgs.createOrganization(ctx, uids[0], { name: 'Test community' });

            for (let i = 1; i <= count; i++) {
                await Modules.Messaging.room.createRoom(ctx, 'public', testCommunity.id, uids[0], uids, {
                    title: `Test group ${i}`,
                });
            }
        });
    }
}