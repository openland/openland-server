import { currentTime } from 'openland-utils/timer';
import 'reflect-metadata';
import { EntityLayer } from './../foundation-orm/EntityLayer';
import { container } from './Modules.container';
import { AllEntities, AllEntitiesDirect } from 'openland-module-db/schema';
import { DBModule } from 'openland-module-db/DBModule';
import { EmailModuleMock } from 'openland-module-email/EmailModule.mock';
import { HooksModuleMock } from 'openland-module-hooks/HooksModule.mock';
import { Context, createNamedContext } from '@openland/context';
import { UsersModule } from '../openland-module-users/UsersModule';
import { openTestDatabase } from 'openland-server/foundationdb';
import { createLogger } from '@openland/log';

const logger = createLogger('environment');

export async function testEnvironmentStart(name: string) {
    let ctx = createNamedContext('text-' + name);
    logger.warn(ctx, 'Starting');

    // Reset container
    container.snapshot();
    container.unbindAll();

    // Set Mock Email
    container.bind('EmailModule').toConstantValue(new EmailModuleMock());
    container.bind('HooksModule').toConstantValue(new HooksModuleMock());

    // Prepare test DB connection
    let start = currentTime();
    logger.log(ctx, 'Opening database');
    let db = await openTestDatabase();
    logger.log(ctx, 'Datbase opened in ' + (currentTime() - start) + ' ms');
    start = currentTime();
    let layer = new EntityLayer(db, 'app');
    let entities = await AllEntitiesDirect.create(layer);
    logger.log(ctx, 'Layer loaded in ' + (currentTime() - start) + ' ms');
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