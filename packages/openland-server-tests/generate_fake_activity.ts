// Register Modules
require('module-alias/register');
import { EntityStorage } from '@openland/foundationdb-entity';
import '../openland-utils/Shutdown';
import { Modules } from 'openland-modules/Modules';
import { loadAllModules } from 'openland-modules/loadAllModules';
import faker from 'faker';
import { Store } from 'openland-module-db/FDB';
import { container } from 'openland-modules/Modules.container';
import { Context, createNamedContext } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { range } from '../openland-utils/range';
import { openDatabase } from 'openland-server/foundationdb';
import { openStore, Conversation } from 'openland-module-db/store';

let rootCtx = createNamedContext('prepare');
faker.seed(123);

export async function createUser(ctx: Context, email: string) {
    if (await Store.User.email.find(ctx, email)) {
        throw Error('User with email ' + email + ' already exists');
    }
    let user = await Modules.Users.createUser(ctx, { email });
    await Modules.Users.createUserProfile(ctx, user.id, {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        phone: faker.phone.phoneNumber(),
        email,
        website: faker.internet.url(),
        about: faker.name.jobTitle()
    });
    await Modules.Auth.createToken(ctx, user.id);

    return user.id;
}

async function generateFakeRoomWithMembers(adminId: number, oid: number, groupAmount: number, membersCount: number, processAmount: number = 10) {

    const ranges = range(0, membersCount, processAmount);

    const groups: Conversation[] = [];

    for (let i = 0; i < groupAmount; i++) {
        const group = await Modules.Messaging.room.createRoom(rootCtx, 'group', oid, adminId, [], { title: `Test Group.${Date.now()}` });
        groups.push(group);
    }

    for (let rangeIndex = 0; rangeIndex < ranges.length; rangeIndex++) {

        let usersIds: number[] = [];
        await inTx(rootCtx, async (ctx2) => {
            usersIds = [];
            for (let i = ranges[rangeIndex]; i < (ranges.length === rangeIndex + 1 ? membersCount : ranges[rangeIndex] + processAmount); i++) {
                const uid = await createUser(ctx2, `test1111${i}@openland.com`);
                await Modules.Orgs.addUserToOrganization(ctx2, uid, oid, adminId, false, false);
                usersIds.push(uid);
            }

            const group = groups[Math.floor(Math.random() * groups.length)];
            await Modules.Messaging.room.inviteToRoom(ctx2, group.id, adminId, usersIds);
        });
    }
}

export async function prepare() {
    try {
        if (process.env.NODE_ENV === 'production') {
            throw Error('Unable to prepare database for production deployment');
        }

        // Init DB
        let db = await openDatabase();

        // New Entity
        let storage = new EntityStorage(db);
        let store = await openStore(storage);
        container.bind('Store')
            .toDynamicValue(() => store)
            .inSingletonScope();

        let ctx = rootCtx;
        if (await Store.Environment.findById(ctx, 1)) {
            throw Error('Unable to prepare production database');
        }

        // Load other modules
        await loadAllModules(rootCtx, false);

        // Developer account
        const adminMail = 'bot@openland.com';
        let adminId = await createUser(ctx, adminMail);
        await Modules.Super.makeSuperAdmin(ctx, adminId, 'super-admin');
        let org = await Modules.Orgs.createOrganization(ctx, adminId, { name: 'Developer Organization' });
        // const start = Date.now();

        const count = 1000;
        await generateFakeRoomWithMembers(adminId, org.id, 10, count, 100);
        // console.log(`processed in ${(Date.now() - start) / 1000} with approx ${count / ((Date.now() - start) / 1000)} per s`);

        process.exit();
    } catch (e) {
        // console.warn(e);
        process.abort();
    }
}

// tslint:disable-next-line:no-floating-promises
prepare();
