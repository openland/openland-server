import { VostokOperationsManager } from './VostokOperationsManager';
import { VostokConnection } from './VostokConnection';
import { createIterator } from '../../openland-utils/asyncIterator';
import {
    encodeAckMessages,
    encodeMessage, encodeMessageIsProcessingResponse, encodeMessageNotFoundResponse,
    encodeMessagesContainer, encodeMessagesInfoRequest,
    isAckMessages,
    isMessage, isMessageNotFoundResponse,
    isMessagesInfoRequest, isResendMessageAnswerRequest,
    KnownTypes,
    makeAckMessages,
    makeMessage, makeMessageIsProcessingResponse,
    makeMessageNotFoundResponse, makeMessagesContainer, makeMessagesInfoRequest, MessageNotFoundResponseShape,
    MessageShape, MessagesInfoRequestShape, ResendMessageAnswerRequestShape
} from '../vostok-schema/VostokTypes';
import { RotatingMap } from '../../openland-utils/RotatingSizeMap';
import { cancelContext, forever, withLifetime } from '@openland/lifetime';
import { createNamedContext } from '@openland/context';
import { delay } from '../../openland-utils/timer';
import { createLogger } from '@openland/log';
import { asyncRun, makeMessageId } from '../utils';
import { RotatingSet } from '../../openland-utils/RotatingSet';
import { MESSAGE_INFO_REQ_TIMEOUT } from './vostokServer';

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

    readonly outgoingMessagesMap = new RotatingMap<string, OutMessage>(1024);
    readonly incomingMessagesMap = new RotatingMap<string, InMessage>(1024);
    readonly acknowledgedIncomingMessages = new RotatingSet<string>(1024);

    private ctx = withLifetime(createNamedContext('vostok-session'));

    constructor(sessionId: string) {
        this.sessionId = sessionId;
        this.setupAckLoop();
    }

    setupAckLoop() {
        forever(this.ctx, async () => {
            let ids: string[] = [];

            for (let entry of this.outgoingMessagesMap.entries()) {
                if (entry[1].delivered && ((Date.now() - entry[1].deliveredAt!) > MESSAGE_INFO_REQ_TIMEOUT)) {
                    ids.push(entry[1].msg.id);
                }
            }
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
        this.outgoingMessagesMap.set(message.id, { msg: message, delivered: false, answerToMessage });
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
            let msg = this.outgoingMessagesMap.get(message.id)!;
            msg.delivered = true;
            msg.deliveredAt = Date.now();
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
                } else if (isMessageNotFoundResponse(msgData)) {
                    this.handleMessageNotFoundResponse(msgData);
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
        this.outgoingMessagesMap.clear();
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
        if (incomingMessage && incomingMessage.responseMessage && this.outgoingMessagesMap.has(incomingMessage.responseMessage)) {
            this.sendRaw(encodeMessage(this.outgoingMessagesMap.get(incomingMessage.responseMessage)!.msg));
            return;
        } else if (incomingMessage) {
            this.sendRaw(encodeMessageIsProcessingResponse(makeMessageIsProcessingResponse({ messageId: req.messageId })));
            return;
        }

        this.sendRaw(encodeMessageNotFoundResponse(makeMessageNotFoundResponse({ messageId: req.messageId })));
    }

    /**
     * Most likely server receives this as a response to MessagesInfoRequest request
     * and sends this message again if it has not been forgotten already
     */
    private handleMessageNotFoundResponse(res: MessageNotFoundResponseShape) {
        if (this.outgoingMessagesMap.has(res.messageId)) {
            this.sendRaw(encodeMessage(this.outgoingMessagesMap.get(res.messageId)!.msg));
        }
    }

    /**
     * Returns connection from which the last `Pong` came
     */
    private freshestConnect() {
        return this.connections.sort((a, b) => b.connection.lastPingAck - b.connection.lastPingAck)[0];
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
            let message = this.outgoingMessagesMap.get(id);
            if (!message) {
                log.log(rootCtx, 'attempt to ack unknown message', id);
                continue;
            }
            if (message.answerToMessage) {
                this.incomingMessagesMap.delete(message.answerToMessage);
            }
            this.outgoingMessagesMap.delete(id);
        }
    }

    private deliverMessages() {
        for (let msgId of this.outgoingMessagesMap.keys()) {
            let msg = this.outgoingMessagesMap.get(msgId)!;
            if (!msg.delivered) {
                this.send(msg.msg.body, msg.msg.ackMessages || undefined);
                this.outgoingMessagesMap.delete(msgId);
            }
        }
    }
}