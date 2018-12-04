// Register Modules
require('module-alias/register');

import { Modules } from 'openland-modules/Modules';
import { createEmptyContext, Context } from 'openland-utils/Context';
import faker from 'faker';
faker.seed(123);

import '../openland-utils/Shutdown';

import { loadAllModules } from 'openland-modules/loadAllModules';
async function initServer() {
    try {
        loadAllModules();
        // await startAllModules();
    } catch (e) {
        console.error('Unable to init server');
        console.error(e);
        process.abort();
    }
}

async function createUser(ctx: Context, email: string) {
    if (await Modules.Users.findUserByAuthId(ctx, 'email|' + email)) {
        throw Error('User with email ' + email + ' already exists');
    }
    let user = await Modules.Users.createUser(ctx, 'email|' + email, email);
    await Modules.Users.createUserProfile(ctx, user.id, {
        firstName: faker.name.findName(),
        lastName: faker.name.lastName(),
        phone: faker.phone.phoneNumber(),
        email,
        website: faker.internet.url(),
        about: faker.name.jobTitle()
    });
}

export async function prepare() {
    if (process.env.NODE_ENV === 'production') {
        throw Error('Unable to prepare database for production deployment');
    }
    try {

        await initServer();

        let ctx = createEmptyContext();

        await createUser(ctx, 'test1111@openland.com');
        await createUser(ctx, 'test1112@openland.com');
        await createUser(ctx, 'test1113@openland.com');
        await createUser(ctx, 'test1114@openland.com');
    }
    finally {
        process.abort();
    }
}

// tslint:disable-next-line:no-floating-promises
prepare();