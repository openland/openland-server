import { Config } from './../openland-config/Config';
import { ServiceBroker } from 'moleculer';
import { Shutdown } from 'openland-utils/Shutdown';
import { container } from 'openland-modules/Modules.container';

export async function createBroker() {
    const broker = new ServiceBroker({
        transporter: Config.redis ? Config.redis.endpoint : 'TCP',
        serializer: 'ProtoBuf'
    });
    container.bind('Broker').toConstantValue(broker);
    await broker.start();
    Shutdown.registerWork({
        name: 'broker',
        shutdown: async () => {
            await broker.stop();
        }
    });
}