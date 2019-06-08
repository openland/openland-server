import 'reflect-metadata';
import { container } from './Modules.container';
import { AllEntities, AllEntitiesDirect } from 'openland-module-db/schema';
import { FConnection } from 'foundation-orm/FConnection';
import { EventBus } from 'openland-module-pubsub/EventBus';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { DBModule } from 'openland-module-db/DBModule';
import { EmailModuleMock } from 'openland-module-email/EmailModule.mock';
import { randomKey } from 'openland-utils/random';
import { HooksModuleMock } from 'openland-module-hooks/HooksModule.mock';
import { Context, EmptyContext } from '@openland/context';
import { UsersModule } from '../openland-module-users/UsersModule';

export async function testEnvironmentStart(name: string) {

    // Reset container
    container.snapshot();
    container.unbindAll();

    // Set Mock Email
    container.bind('EmailModule').toConstantValue(new EmailModuleMock());
    container.bind('HooksModule').toConstantValue(new HooksModuleMock());

    // Prepare test DB connection
    let connection = FConnection.create()
        .at(FKeyEncoding.encodeKey(['_tests_' + name + '_' + randomKey()]));
    await connection.clearRange(FKeyEncoding.encodeKey([]));
    let cnn = new FConnection(connection, EventBus);
    let entities = new AllEntitiesDirect(cnn);
    await cnn.ready(EmptyContext);
    container.bind(DBModule).toSelf().inSingletonScope();
    container.bind<AllEntities>('FDB')
        .toConstantValue(entities);
}

export function testEnvironmentEnd() {
    container.restore();
}

const randStr = () => (Math.random() * Math.pow(2, 55)).toString(16);

export async function randomTestUser(ctx: Context) {
    let users = container.get<UsersModule>(UsersModule);
    let email = 'test' + randStr() + '@openland.com';
    let uid = (await users.createUser(ctx, 'user' + randStr(), email)).id;
    await users.createUserProfile(ctx, uid, { firstName: 'User Name' + Math.random() });
    return { uid, email };
}