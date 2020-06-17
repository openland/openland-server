import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import * as moleculer from 'moleculer';
import { Client } from 'ts-nats';
import { container } from 'openland-modules/Modules.container';

class NatsTransporter extends moleculer.Transporters.Base {

    private client: Client | null = null;

    constructor() {
        super();
    }

    async connect() {
        this.client = container.get('NATS');
        await this.onConnected(false);
    }

    async disconnect() {
        this.client = null;
    }

    async subscribe(cmd: string, nodeID?: string) {
        if (this.client) {
            const t = this.getTopicName(cmd, nodeID);
            await this.client.subscribe(t, (_, msg) => this.receive(cmd, Buffer.from(msg.data as string, 'base64')));
        }
    }

    async send(topic: string, data: Buffer) {
        if (this.client) {
            this.client.publish(topic, data.toString('base64'));
        }
    }
}
const logger = createLogger('moleculer');
const ctx = createNamedContext('broker');

const BaseLogger = (moleculer as any).Loggers.Base;

class OpenLogger extends BaseLogger {
    getLogHandler(bindings: moleculer.LoggerBindings) {
        return (type: string, args: any[]) => {
            if (type === 'log' || type === 'info') {
                logger.log(ctx, args[0], ...args.slice(1));
            } else if (type === 'warn') {
                logger.warn(ctx, args[0], ...args.slice(1));
            } else if (type === 'error') {
                logger.error(ctx, args[0], ...args.slice(1));
            }
        };
    }
}

export const broker = new moleculer.ServiceBroker({
    transporter: new NatsTransporter(),
    logger: new OpenLogger() as any
});