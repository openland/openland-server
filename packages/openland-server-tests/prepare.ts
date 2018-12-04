// Register Modules
require('module-alias/register');
import '../openland-utils/Shutdown';
import { Modules } from 'openland-modules/Modules';
import { createEmptyContext, Context } from 'openland-utils/Context';
import { loadAllModules } from 'openland-modules/loadAllModules';
import faker from 'faker';
import { FDB } from 'openland-module-db/FDB';
import { container } from 'openland-modules/Modules.container';
import { AllEntities, AllEntitiesDirect } from 'openland-module-db/schema';
import { FConnection } from 'foundation-orm/FConnection';
import { EventBus } from 'openland-module-pubsub/EventBus';
faker.seed(123);

async function createUser(ctx: Context, email: string) {
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
}

export async function prepare() {
    try {
        if (process.env.NODE_ENV === 'production') {
            throw Error('Unable to prepare database for production deployment');
        }

        // Init DB
        container.bind<AllEntities>('FDB')
            .toDynamicValue(() => new AllEntitiesDirect(new FConnection(FConnection.create(), EventBus)))
            .inSingletonScope();
        let ctx = createEmptyContext();
        if (await FDB.Environment.findById(ctx, 1)) {
            throw Error('Unable to prepare production database');
        }

        // Clear DB
        await FDB.connection.fdb.clearRange(Buffer.from([0x00]), Buffer.from([0xff]));

        // Load other modules
        loadAllModules(false);

        // Create entities
        await createUser(ctx, 'test1111@openland.com');
        await createUser(ctx, 'test1112@openland.com');
        await createUser(ctx, 'test1113@openland.com');
        await createUser(ctx, 'test1114@openland.com');

        process.exit();
    } catch (e) {
        console.warn(e);
        process.abort();
    }
}

// tslint:disable-next-line:no-floating-promises
prepare();