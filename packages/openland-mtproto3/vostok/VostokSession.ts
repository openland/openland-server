import { VostokOperationsManager } from './VostokOperationsManager';
import { VostokConnection } from './VostokConnection';
import { createIterator } from '../../openland-utils/asyncIterator';
import {
    encodeAckMessages,
    encodeMessage,
    encodeMessagesInfoRequest, isAckMessages, isMessage,
    KnownTypes, makeAckMessages, makeMessage,
    makeMessagesInfoRequest,
    MessageShape
} from '../vostok-schema/VostokTypes';
import { RotatingMap } from '../../openland-utils/FixedSizeMap';
import { cancelContext, forever, withLifetime } from '@openland/lifetime';
import { createNamedContext } from '@openland/context';
import { delay } from '../../openland-utils/timer';
import { createLogger } from '@openland/log';
import { asyncRun, makeMessageId } from '../utils';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

export class VostokSession {
    public sessionId: string;
    public state: 'active' | 'closed' = 'active';
    public authParams: any;
    public operations = new VostokOperationsManager();
    public connections: { connection: VostokConnection }[] = [];
    public noConnectsSince: number|null = null;

    readonly incomingMessages = createIterator<{ message: MessageShape, connection: VostokConnection }>(() => 0);

    readonly waitingDelivery: MessageShape[] = [];
    readonly outcomingMessagesMap = new RotatingMap<string, { msg: MessageShape, delivered: boolean }>(1024);
    readonly incomingMessagesMap = new RotatingMap<string, MessageShape>(1024);

    private ctx = withLifetime(createNamedContext('vostok-session'));

    constructor(sessionId: string) {
        this.sessionId = sessionId;
        this.setupAckLoop();
    }

    setupAckLoop() {
        forever(this.ctx, async () => {
            let ids = [...this.outcomingMessagesMap.keys()];
            if (ids.length > 0) {
                this.sendRaw(encodeMessagesInfoRequest(makeMessagesInfoRequest({ ids })));
            }
            await delay(5000);
        });
    }

    send(body: KnownTypes, acks?: string[]) {
        let message = makeMessage({ id: makeMessageId(), body, ackMessages: acks || null });
        let connect = this.freshestConnect();
        let delivered = false;

        if (connect && connect.connection.isConnected()) {
            log.log(rootCtx, '->', JSON.stringify(message));
            connect.connection.sendRaw(encodeMessage(message));
            delivered = true;
        } else {
            log.log(rootCtx, '?->', JSON.stringify(message));
            this.waitingDelivery.push(message);
        }
        this.outcomingMessagesMap.set(message.id, { msg: message, delivered });

        return message;
    }

    sendAck(ids: string[]) {
        this.sendRaw(encodeAckMessages(makeAckMessages({ ids })));
    }

    deliverQueuedMessages() {
        let len = this.waitingDelivery.length;
        for (let msg of this.waitingDelivery) {
            this.send(msg.body, msg.ackMessages || undefined);
        }
        this.waitingDelivery.splice(0, len);
    }

    addConnection(connection: VostokConnection) {
        let conn = { connection };
        this.connections.push(conn);
        this.noConnectsSince = null;
        this.deliverQueuedMessages();

        asyncRun(async () => {
            for await (let msgData of connection.getIncomingMessagesIterator()) {
                if (isMessage(msgData)) {
                    this.incomingMessagesMap.set(msgData.id, msgData);
                    this.incomingMessages.push({ message: msgData, connection });
                } else if (isAckMessages(msgData)) {
                    for (let id of msgData.ids) {
                        this.outcomingMessagesMap.delete(id);
                    }
                }
            }

            this.connections.splice(this.connections.findIndex(c => c === conn), 1);

            if (this.connections.length === 0) {
                this.noConnectsSince = Date.now();
            }
        });
    }

    destroy = () => {
        if (this.state === 'closed') {
            return;
        }
        this.state = 'closed';
        cancelContext(this.ctx);
        this.operations.stopAll();
        this.incomingMessagesMap.clear();
        this.outcomingMessagesMap.clear();
        this.incomingMessages.complete();
        this.connections.forEach(c => c.connection.close());
        this.connections = [];
        this.noConnectsSince = Date.now();
    }

    private freshestConnect() {
        let connects = this.connections.sort((a, b) => b.connection.lastPingAck - b.connection.lastPingAck);
        return connects[0];
    }

    // has no delivery guarantee
    private sendRaw(data: any) {
        if (this.freshestConnect()) {
            this.freshestConnect().connection.sendRaw(data);
        }
    }
}