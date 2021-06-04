import { EventsModule } from 'openland-module-events/EventsModule';
import { Store } from './../openland-module-db/store';
import { openStore } from 'openland-module-db/store';
import { EntityStorage } from '@openland/foundationdb-entity';
import { currentTime } from 'openland-utils/timer';
import 'reflect-metadata';
import { container } from './Modules.container';
import { EmailModuleMock } from 'openland-module-email/EmailModule.mock';
import { HooksModuleMock } from 'openland-module-hooks/HooksModule.mock';
import { Context, createNamedContext } from '@openland/context';
import { UsersModule } from '../openland-module-users/UsersModule';
import { openTestDatabase } from 'openland-server/foundationdb';
import { createLogger } from '@openland/log';

import { StatsModule } from '../openland-module-stats/StatsModule';
import { loadMonitoringModule } from 'openland-module-monitoring/loadMonitoringModule';
import { Modules } from './Modules';
import { createHandyClient } from 'handy-redis';
import { Config } from 'openland-config/Config';
import { inTx } from '@openland/foundationdb';

const logger = createLogger('environment');

export async function testEnvironmentStart(name: string) {
    let ctx = createNamedContext('text-' + name);
    logger.log(ctx, 'Starting');

    // Reset container
    container.snapshot();
    container.unbindAll();

    // Redis
    const redis = createHandyClient({ url: Config.redis.endpoint });
    container.bind('Redis').toConstantValue(redis);

    // Set Mock Email
    container.bind('EmailModule').toConstantValue(new EmailModuleMock());
    container.bind('HooksModule').toConstantValue(new HooksModuleMock());
    container.bind(EventsModule).toSelf().inSingletonScope();
    container.bind(StatsModule).toSelf().inSingletonScope();

    // Prepare test DB connection
    let start = currentTime();
    logger.log(ctx, 'Opening database');
    let db = await openTestDatabase();
    logger.log(ctx, 'Datbase opened in ' + (currentTime() - start) + ' ms');

    // New Entity
    let storage = new EntityStorage(db);
    start = currentTime();
    logger.log(ctx, 'Opening store');
    let store = await inTx(ctx, (c) => openStore(c, storage));
    logger.log(ctx, 'Store opened in ' + (currentTime() - start) + ' ms');
    container.bind<Store>('Store')
        .toConstantValue(store);

    loadMonitoringModule();
}

export async function testEnvironmentEnd() {
    container.restore();
}

const randStr = () => (Math.random() * Math.pow(2, 55)).toString(16);

export async function randomTestUser(ctx: Context) {
    let users = container.get<UsersModule>(UsersModule);
    let email = 'test' + randStr() + '@openland.com';
    let uid = (await users.createUser(ctx, { email })).id;
    await users.createUserProfile(ctx, uid, { firstName: 'User Name' + Math.random() });
    await Modules.Events.mediator.prepareUser(ctx, uid);
    return { uid, email };
}
