import { VostokOperationsManager } from './VostokOperationsManager';
import { VostokConnection } from './VostokConnection';
import { createIterator } from '../../openland-utils/asyncIterator';
import { RotatingMap } from '../../openland-utils/RotatingSizeMap';
import { cancelContext, forever, withLifetime } from '@openland/lifetime';
import { createNamedContext } from '@openland/context';
import { delay } from '../../openland-utils/timer';
import { createLogger } from '@openland/log';
import { asyncRun, makeMessageId } from '../utils';
import { RotatingSet } from '../../openland-utils/RotatingSet';
import { MESSAGE_INFO_REQ_TIMEOUT } from './vostokServer';
import { google, vostok } from './schema/schema';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

type MessageID = Uint8Array;

interface OutMessage {
    msg: vostok.IMessage;
    delivered: boolean;
    deliveredAt?: number;
    answerToMessage?: MessageID;
}

interface InMessage {
    msg: vostok.IMessage;
    responseMessage?: MessageID;
}

type MessageInput = {
    /** Message ackMessages */
    ackMessages?: (string[]|null);

    /** Message body */
    body: google.protobuf.IAny;
};

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
    readonly incomingMessages = createIterator<{ message: vostok.IMessage, connection: VostokConnection }>(() => 0);

    readonly outgoingMessagesMap = new RotatingMap<MessageID, OutMessage>(1024);
    readonly incomingMessagesMap = new RotatingMap<MessageID, InMessage>(1024);
    readonly acknowledgedIncomingMessages = new RotatingSet<MessageID>(1024);

    private ctx = withLifetime(createNamedContext('vostok-session'));

    constructor(sessionId: string) {
        this.sessionId = sessionId;
        this.setupAckLoop();
    }

    setupAckLoop() {
        forever(this.ctx, async () => {
            let ids: MessageID[] = [];

            for (let entry of this.outgoingMessagesMap.entries()) {
                if (entry[1].delivered && ((Date.now() - entry[1].deliveredAt!) > MESSAGE_INFO_REQ_TIMEOUT)) {
                    ids.push(entry[1].msg.id);
                }
            }
            if (ids.length > 0) {
                this.sendRaw(vostok.TopMessage.encode({ messagesInfoRequest: { messageIds: ids }}).finish());
            }
            await delay(5000);
        });
    }

    send(messageInput: MessageInput, acks?: string[], answerToMessage?: MessageID) {
        let message = vostok.Message.create({ ...messageInput, id: makeMessageId(), ackMessages: acks || [] });

        // Store
        this.outgoingMessagesMap.set(message.id, { msg: message, delivered: false, answerToMessage });
        if (answerToMessage) {
            let reqMessage = this.incomingMessagesMap.get(answerToMessage);
            if (reqMessage) {
                reqMessage.responseMessage = message.id;
            }
        }

        // Try to deliver
        this.deliverMessage(message);

        return message;
    }

    /**
     * If answerToMessages is passed those messages will be deleted from cache
     */
    sendAck(ids: MessageID[], answerToMessages?: MessageID[]) {
        this.sendRaw(vostok.TopMessage.encode({ ackMessages: { ids } }).finish());
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
                if (msgData instanceof vostok.Message) {
                    this.incomingMessagesMap.set(msgData.id, { msg: msgData });
                    this.incomingMessages.push({ message: msgData, connection });
                } else if (msgData instanceof vostok.AckMessages) {
                    this.handleMessageAcks(msgData.ids);
                } else if (msgData instanceof vostok.MessagesInfoRequest) {
                    this.handleMessagesInfoRequest(msgData);
                } else if (msgData instanceof vostok.ResendMessageAnswerRequest) {
                    this.handleResendMessageAnswerRequest(msgData);
                } else if (msgData instanceof vostok.MessageNotFoundResponse) {
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

    private handleMessagesInfoRequest(req: vostok.MessagesInfoRequest) {
        let response = vostok.TopMessage.create({ messagesContainer: vostok.MessagesContainer.create({ messages: [] }) });

        for (let id of req.messageIds) {
            if (this.incomingMessagesMap.has(id) || this.acknowledgedIncomingMessages.has(id)) {
                response.messagesContainer!.messages!.push(vostok.TopMessage.create({ ackMessages: { ids: [id] } }));

            } else {
                response.messagesContainer!.messages!.push(vostok.TopMessage.create({ messageNotFoundResponse: { messageId: id }}));
            }
        }

        this.sendRaw(vostok.TopMessage.encode(response).finish());
    }

    private handleResendMessageAnswerRequest(req: vostok.ResendMessageAnswerRequest) {
        let incomingMessage = this.incomingMessagesMap.get(req.messageId);
        if (incomingMessage && incomingMessage.responseMessage && this.outgoingMessagesMap.has(incomingMessage.responseMessage)) {
            this.sendRaw(vostok.TopMessage.encode({ message: this.outgoingMessagesMap.get(incomingMessage.responseMessage)!.msg }).finish());
            return;
        } else if (incomingMessage) {
            this.sendRaw(vostok.TopMessage.encode({ messageIsProcessingResponse: { messageId: req.messageId }}).finish());
            return;
        }

        this.sendRaw(vostok.TopMessage.encode({ messageNotFoundResponse: { messageId: req.messageId }}).finish());
    }

    /**
     * Most likely server receives this as a response to MessagesInfoRequest request
     * and sends this message again if it has not been forgotten already
     */
    private handleMessageNotFoundResponse(res: vostok.MessageNotFoundResponse) {
        if (this.outgoingMessagesMap.has(res.messageId)) {
            this.sendRaw(vostok.TopMessage.encode({ message: this.outgoingMessagesMap.get(res.messageId)!.msg }).finish());
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
    private sendRaw(data: Uint8Array) {
        if (this.freshestConnect()) {
            this.freshestConnect().connection.sendBuff(data);
        }
    }

    private handleMessageAcks(ids: MessageID[]) {
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
                this.deliverMessage(msg.msg);
            }
        }
    }

    private deliverMessage(message: vostok.IMessage) {
        let connect = this.freshestConnect();

        // Try to deliver
        if (connect && connect.connection.isConnected()) {
            log.log(rootCtx, '->', message);
            connect.connection.sendBuff(vostok.TopMessage.encode({ message }).finish());
            let msg = this.outgoingMessagesMap.get(message.id)!;
            msg.delivered = true;
            msg.deliveredAt = Date.now();
        }

        return message;
    }
}