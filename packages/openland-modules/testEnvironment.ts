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
    container.bind(DBModule).toSelf().inSingletonScope();
    container.bind<AllEntities>('FDB')
        .toConstantValue(new AllEntitiesDirect(new FConnection(connection, EventBus)));
}

export function testEnvironmentEnd() {
    container.restore();
}