import { EntityLayer } from 'foundation-orm/EntityLayer';
// Register Modules

require('module-alias/register');
import '../openland-utils/Shutdown';
import { Modules } from 'openland-modules/Modules';
import { loadAllModules } from 'openland-modules/loadAllModules';
import faker from 'faker';
import { FDB } from 'openland-module-db/FDB';
import { container } from 'openland-modules/Modules.container';
import { AllEntities, AllEntitiesDirect, Conversation } from 'openland-module-db/schema';
import { FConnection } from 'foundation-orm/FConnection';
import { EventBus } from 'openland-module-pubsub/EventBus';
import { Context, createNamedContext } from '@openland/context';
import { inTx } from 'foundation-orm/inTx';
import { range } from '../openland-utils/range';

let rootCtx = createNamedContext('prepare');
faker.seed(123);

export async function createUser(ctx: Context, email: string) {
    if (await Modules.Users.findUserByAuthId(ctx, 'email|' + email)) {
        throw Error('User with email ' + email + ' already exists');
    }
    let user = await Modules.Users.createUser(ctx, 'email|' + email, email);
    await Modules.Users.createUserProfile(ctx, user.id, {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        phone: faker.phone.phoneNumber(),
        email,
        website: faker.internet.url(),
        about: faker.name.jobTitle()
    });
    await Modules.Auth.createToken(ctx, user.id);
    await Modules.Users.activateUser(ctx, user.id, false);

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
        let connection = new FConnection(FConnection.create());
        let layer = new EntityLayer(connection, EventBus);
        let entities = new AllEntitiesDirect(layer);
        await connection.ready(rootCtx);
        await layer.ready(rootCtx);
        container.bind<AllEntities>('FDB')
            .toDynamicValue(() => entities)
            .inSingletonScope();
        let ctx = rootCtx;
        if (await FDB.Environment.findById(ctx, 1)) {
            throw Error('Unable to prepare production database');
        }

        // Clear DB
        await FDB.layer.db.fdb.clearRange(Buffer.from([0x00]), Buffer.from([0xff]));

        // Load other modules
        await loadAllModules(rootCtx, false);

        // Developer account
        const adminMail = 'bot@openland.com';
        let adminId = await createUser(ctx, adminMail);
        await Modules.Super.makeSuperAdmin(ctx, adminId, 'super-admin');
        await Modules.Users.activateUser(ctx, adminId, false);
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