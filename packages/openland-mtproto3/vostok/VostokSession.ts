import { VostokOperationsManager } from './VostokOperationsManager';
import { VostokConnection } from './VostokConnection';
import { createIterator } from '../../openland-utils/asyncIterator';
import {
    encodeAckMessages,
    encodeMessage, encodeMessageIsProcessingResponse, encodeMessageNotFoundResponse,
    encodeMessagesContainer, encodeMessagesInfoRequest,
    isAckMessages,
    isMessage,
    isMessagesInfoRequest, isResendMessageAnswerRequest,
    KnownTypes,
    makeAckMessages,
    makeMessage, makeMessageIsProcessingResponse,
    makeMessageNotFoundResponse, makeMessagesContainer, makeMessagesInfoRequest,
    MessageShape, MessagesInfoRequestShape, ResendMessageAnswerRequestShape
} from '../vostok-schema/VostokTypes';
import { RotatingMap } from '../../openland-utils/RotatingSizeMap';
import { cancelContext, forever, withLifetime } from '@openland/lifetime';
import { createNamedContext } from '@openland/context';
import { delay } from '../../openland-utils/timer';
import { createLogger } from '@openland/log';
import { asyncRun, makeMessageId } from '../utils';
import { RotatingSet } from '../../openland-utils/RotatingSet';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

interface OutMessage {
    msg: MessageShape;
    delivered: boolean;
    deliveredAt?: number;
    answerToMessage?: string;
}

interface InMessage {
    msg: MessageShape;
    responseMessage?: string;
}

export class VostokSession {
    public sessionId: string;
    public state: 'active' | 'closed' = 'active';
    public authParams: any;
    public operations = new VostokOperationsManager();
    public connections: { connection: VostokConnection }[] = [];
    public noConnectsSince: number|null = null;

    /**
     * Iterator which contains all incoming messages from all active connections
     */
    readonly incomingMessages = createIterator<{ message: MessageShape, connection: VostokConnection }>(() => 0);

    readonly outcomingMessagesMap = new RotatingMap<string, OutMessage>(1024);
    readonly incomingMessagesMap = new RotatingMap<string, InMessage>(1024);
    readonly acknowledgedIncomingMessages = new RotatingSet<string>(1024);

    private ctx = withLifetime(createNamedContext('vostok-session'));

    constructor(sessionId: string) {
        this.sessionId = sessionId;
        this.setupAckLoop();
    }

    setupAckLoop() {
        // send requests only for delivered messages and after some timeout
        forever(this.ctx, async () => {
            let ids = [...this.outcomingMessagesMap.keys()];
            if (ids.length > 0) {
                this.sendRaw(encodeMessagesInfoRequest(makeMessagesInfoRequest({ messageIds: ids })));
            }
            await delay(5000);
        });
    }

    send(body: KnownTypes, acks?: string[], answerToMessage?: string) {
        let message = makeMessage({ id: makeMessageId(), body, ackMessages: acks || null });
        let connect = this.freshestConnect();

        // Store
        this.outcomingMessagesMap.set(message.id, { msg: message, delivered: false, answerToMessage });
        if (answerToMessage) {
            let reqMessage = this.incomingMessagesMap.get(answerToMessage);
            if (reqMessage) {
                reqMessage.responseMessage = message.id;
            }
        }

        // Try to deliver
        if (connect && connect.connection.isConnected()) {
            log.log(rootCtx, '->', JSON.stringify(message));
            connect.connection.sendRaw(encodeMessage(message));
            this.outcomingMessagesMap.get(message.id)!.delivered = true;
        }

        return message;
    }

    /**
     * If answerToMessages is passed those messages will be deleted from cache
     */
    sendAck(ids: string[], answerToMessages?: string[]) {
        this.sendRaw(encodeAckMessages(makeAckMessages({ ids })));
        ids.forEach(id => this.acknowledgedIncomingMessages.add(id));
        if (answerToMessages) {
            for (let id of answerToMessages) {
                this.incomingMessagesMap.delete(id);
            }
        }
    }

    addConnection(connection: VostokConnection) {
        let conn = { connection };
        this.connections.push(conn);
        this.noConnectsSince = null;
        this.deliverMessages();

        asyncRun(async () => {
            for await (let msgData of connection.getIncomingMessagesIterator()) {
                if (isMessage(msgData)) {
                    this.incomingMessagesMap.set(msgData.id, { msg: msgData });
                    this.incomingMessages.push({ message: msgData, connection });
                } else if (isAckMessages(msgData)) {
                    this.handleMessageAcks(msgData.ids);
                } else if (isMessagesInfoRequest(msgData)) {
                    this.handleMessagesInfoRequest(msgData);
                } else if (isResendMessageAnswerRequest(msgData)) {
                    this.handleResendMessageAnswerRequest(msgData);
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

    private handleMessagesInfoRequest(req: MessagesInfoRequestShape) {
        let response = makeMessagesContainer({ messages: [] });

        for (let id of req.messageIds) {
            if (this.incomingMessagesMap.has(id) || this.acknowledgedIncomingMessages.has(id)) {
                response.messages.push(makeAckMessages({ ids: [id] }));
            } else {
                response.messages.push(makeMessageNotFoundResponse({ messageId: id }));
            }
        }

        this.sendRaw(encodeMessagesContainer(response));
    }

    private handleResendMessageAnswerRequest(req: ResendMessageAnswerRequestShape) {
        let incomingMessage = this.incomingMessagesMap.get(req.messageId);
        if (incomingMessage && incomingMessage.responseMessage && this.outcomingMessagesMap.has(incomingMessage.responseMessage)) {
            this.sendRaw(this.outcomingMessagesMap.get(incomingMessage.responseMessage));
            return;
        } else if (incomingMessage) {
            this.sendRaw(encodeMessageIsProcessingResponse(makeMessageIsProcessingResponse({ messageId: req.messageId })));
            return;
        }

        this.sendRaw(encodeMessageNotFoundResponse(makeMessageNotFoundResponse({ messageId: req.messageId })));
    }

    /**
     * Returns connect which sent Pong last
     */
    private freshestConnect() {
        let connects = this.connections.sort((a, b) => b.connection.lastPingAck - b.connection.lastPingAck);
        return connects[0];
    }

    /**
     * Has no delivery guarantee
     */
    private sendRaw(data: any) {
        if (this.freshestConnect()) {
            this.freshestConnect().connection.sendRaw(data);
        }
    }

    private handleMessageAcks(ids: string[]) {
        for (let id of ids) {
            let message = this.outcomingMessagesMap.get(id);
            if (!message) {
                log.log(rootCtx, 'attempt to ack unknown message', id);
                continue;
            }
            if (message.answerToMessage) {
                this.incomingMessagesMap.delete(message.answerToMessage);
            }
            this.outcomingMessagesMap.delete(id);
        }
    }

    private deliverMessages() {
        for (let msgId of this.outcomingMessagesMap.keys()) {
            let msg = this.outcomingMessagesMap.get(msgId)!;
            if (!msg.delivered) {
                this.send(msg.msg.body, msg.msg.ackMessages || undefined);
                this.outcomingMessagesMap.delete(msgId);
            }
        }
    }
}