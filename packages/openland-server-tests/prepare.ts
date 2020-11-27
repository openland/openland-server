// Register Modules
require('module-alias/register');
import { Store } from 'openland-module-db/FDB';
import { openStore } from './../openland-module-db/store';
import '../openland-utils/Shutdown';
import { Modules } from 'openland-modules/Modules';
import { loadAllModules } from 'openland-modules/loadAllModules';
import faker from 'faker';
import { container } from 'openland-modules/Modules.container';
import { inTx } from '@openland/foundationdb';
import { Context, createNamedContext } from '@openland/context';
import { openDatabase } from 'openland-server/foundationdb';
import { EntityStorage } from '@openland/foundationdb-entity';

let rootCtx = createNamedContext('prepare');
faker.seed(123);

async function createUser(ctx: Context, email: string) {
    if (await Modules.Users.findUserByAuthId(ctx, 'email|' + email)) {
        throw Error('User with email ' + email + ' already exists');
    }
    let user = await Modules.Users.createUser(ctx, {email});
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

export async function prepare() {
    try {
        if (process.env.NODE_ENV === 'production') {
            throw Error('Unable to prepare database for production deployment');
        }

        // Init DB
        let db = await openDatabase();

        // Clear DB
        // await inTx(rootCtx, async (ctx2) => {
        //     db.allKeys.clearRange(ctx2, Buffer.from([0x00]), Buffer.from([0xff]));
        // });

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

        // Create entities
        await createUser(ctx, 'test1111@openland.com');
        await createUser(ctx, 'test1112@openland.com');
        await createUser(ctx, 'test1113@openland.com');
        await createUser(ctx, 'test1114@openland.com');

        // Developer account
        let uid = await createUser(ctx, 'bot@openland.com');
        await Modules.Super.makeSuperAdmin(ctx, uid, 'super-admin');
        let org = await Modules.Orgs.createOrganization(ctx, uid, { name: 'Developer Organization' });
        let group = await Modules.Messaging.room.createRoom(ctx, 'group', org.id, uid, [], { title: 'Test Group' });
        // for (let i = 0; i < 150; i++) {
        //     console.log('create user #' + i);
        let users: number[] = [];
        await inTx(rootCtx, async (ctx2) => {
            for (let j = 0; j < 10; j++) {
                let u = await createUser(ctx2, 'testmember' + j + '@openland.com');
                await Modules.Orgs.addUserToOrganization(ctx2, u, org.id, uid, false, false);
                users.push(u);
            }
        });
        await Modules.Messaging.room.inviteToRoom(rootCtx, group.id, uid, users);
        // }

        process.exit();
    } catch (e) {
        // tslint:disable
        console.warn(e);
        // tslint:enable
        process.abort();
    }
}

// tslint:disable-next-line:no-floating-promises
prepare();
