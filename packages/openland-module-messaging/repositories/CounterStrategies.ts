import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';

type UserGlobalCounter = {
    get(ctx: Context, uid: number): Promise<number>
    set(ctx: Context, uid: number, value: number): void
    add(ctx: Context, uid: number, value: number): void
    decrement(ctx: Context, uid: number): void
    increment(ctx: Context, uid: number): void
};

interface GlobalCounterCalculator {
    onMessageReceived(chatUnread: number, isMuted: boolean): number;
    onMessageDeleted(chatUnread: number, isMuted: boolean): number;
    onMessageRead(chatUnread: number, isMuted: boolean, readCount: number): number;
    onChatDeleted(chatUnread: number, isMuted: boolean): number;
    onMuteChange(chatUnread: number, isMuted: boolean): number;
    calcForChat(chatUnread: number, isMuted: boolean): number;
}

export const AllUnreadMessagesCalculator: GlobalCounterCalculator = {
    onMessageReceived: () => 1,
    onMessageDeleted: () => -1,
    onMessageRead: (chatUnread, isMuted, readCount) => -readCount,
    onChatDeleted: (chatUnread) => -chatUnread,
    onMuteChange: () => 0,
    calcForChat: (chatUnread, isMuted) => chatUnread
};

export const UnreadMessagesWithoutMutedCalculator: GlobalCounterCalculator = {
    onMessageReceived: (chatUnread, isMuted) => isMuted ? 0 : 1,
    onMessageDeleted: (chatUnread, isMuted) => isMuted ? 0 : -1,
    onMessageRead: (chatUnread, isMuted, readCount) => isMuted ? 0 : -readCount,
    onChatDeleted: (chatUnread, isMuted) => isMuted ? 0 : -chatUnread,
    onMuteChange: (chatUnread, isMuted) => isMuted ? -chatUnread : chatUnread,
    calcForChat: (chatUnread, isMuted) => isMuted ? 0 : chatUnread
};

export const AllUnreadChatsCalculator: GlobalCounterCalculator = {
    onMessageReceived: (chatUnread, isMuted) => chatUnread === 1 ? 1 : 0,
    onMessageDeleted: (chatUnread, isMuted) => chatUnread === 0 ? -1 : 0,
    onMessageRead: (chatUnread, isMuted, readCount) => chatUnread === 0 ? -1 : 0,
    onChatDeleted: (chatUnread, isMuted) => chatUnread > 0 ? -1 : 0,
    onMuteChange: () => 0,
    calcForChat: (chatUnread, isMuted) => chatUnread > 0 ? 1 : 0
};

export const UnreadChatsWithoutMutedCalculator: GlobalCounterCalculator = {
    onMessageReceived: (chatUnread, isMuted) => isMuted ? 0 : (chatUnread === 1 ? 1 : 0),
    onMessageDeleted: (chatUnread, isMuted) => isMuted ? 0 : (chatUnread === 0 ? -1 : 0),
    onMessageRead: (chatUnread, isMuted, readCount) => isMuted ? 0 : (chatUnread === 0 ? -1 : 0),
    onChatDeleted: (chatUnread, isMuted) => isMuted ? 0 : (chatUnread > 0 ? -1 : 0),
    onMuteChange: (chatUnread, isMuted) => chatUnread > 0 ? (isMuted ? -1 : 1) : 0,
    calcForChat: (chatUnread, isMuted) => isMuted ? 0 : (chatUnread > 0 ? 1 : 0)
};

function buildStrategy(getCounter: () => UserGlobalCounter, calculator: GlobalCounterCalculator) {
    return {
        counter: () => getCounter(),
        inContext: (ctx: Context, uid: number, cid: number, chatUnread: number, isMuted: boolean) => {
            return {
                onMessageReceived: () => getCounter().add(ctx, uid, calculator.onMessageReceived(chatUnread, isMuted)),
                onMessageDeleted: () => getCounter().add(ctx, uid, calculator.onMessageDeleted(chatUnread, isMuted)),
                onMessageRead: (readCount: number) => getCounter().add(ctx, uid, calculator.onMessageRead(chatUnread, isMuted, readCount)),
                onChatDeleted: () => getCounter().add(ctx, uid, calculator.onChatDeleted(chatUnread, isMuted)),
                onMuteChange: () => getCounter().add(ctx, uid, calculator.onMuteChange(chatUnread, isMuted)),
                calcForChat: () => getCounter().add(ctx, uid, calculator.calcForChat(chatUnread, isMuted)),
            };
        }
    };
}

export const CounterStrategies = [
    buildStrategy(() => Store.UserGlobalCounterAllUnreadMessages, AllUnreadMessagesCalculator),
    buildStrategy(() => Store.UserGlobalCounterUnreadMessagesWithoutMuted, UnreadMessagesWithoutMutedCalculator),
    buildStrategy(() => Store.UserGlobalCounterAllUnreadChats, AllUnreadChatsCalculator),
    buildStrategy(() => Store.UserGlobalCounterUnreadChatsWithoutMuted, UnreadChatsWithoutMutedCalculator),
];

export const CounterStrategyAll = {
    inContext: (ctx: Context, uid: number, cid: number, chatUnread: number, isMuted: boolean) => {
        return {
            onMessageReceived: () => CounterStrategies.map(s => s.inContext(ctx, uid, cid, chatUnread, isMuted).onMessageReceived()),
            onMessageDeleted: () => CounterStrategies.map(s => s.inContext(ctx, uid, cid, chatUnread, isMuted).onMessageDeleted()),
            onMessageRead: (readCount: number) => CounterStrategies.map(s => s.inContext(ctx, uid, cid, chatUnread, isMuted).onMessageRead(readCount)),
            onChatDeleted: () => CounterStrategies.map(s => s.inContext(ctx, uid, cid, chatUnread, isMuted).onChatDeleted()),
            onMuteChange: () => CounterStrategies.map(s => s.inContext(ctx, uid, cid, chatUnread, isMuted).onMuteChange()),
            calcForChat: () => CounterStrategies.map(s => s.inContext(ctx, uid, cid, chatUnread, isMuted).calcForChat()),
        };
    }
};