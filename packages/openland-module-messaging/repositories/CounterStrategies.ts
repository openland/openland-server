import { Context } from '@openland/context';
import { FDB, Store } from '../../openland-module-db/FDB';

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
    onMuteChange: (chatUnread, isMuted) => isMuted ? -1 : 1,
    calcForChat: (chatUnread, isMuted) => isMuted ? 0 : (chatUnread > 0 ? 1 : 0)
};

const isChatMuted = async (ctx: Context, uid: number, cid: number) => {
    let settings = await FDB.UserDialogSettings.findById(ctx, uid, cid);
    if (settings && settings.mute) {
        return true;
    }
    return false;
};

function buildStrategy(getCounter: () => UserGlobalCounter, calculator: GlobalCounterCalculator) {
    return {
        counter: () => getCounter(),
        inContext: (ctx: Context, uid: number, cid: number) => {
            let chatUnread = Store.UserDialogCounter.get(ctx, uid, cid);
            let isMuted = isChatMuted(ctx, uid, cid);

            return {
                onMessageReceived: async () => await getCounter().add(ctx, uid, calculator.onMessageReceived(await chatUnread, await isMuted)),
                onMessageDeleted: async () => await getCounter().add(ctx, uid, calculator.onMessageDeleted(await chatUnread, await isMuted)),
                onMessageRead: async (readCount: number) => await getCounter().add(ctx, uid, calculator.onMessageRead(await chatUnread, await isMuted, readCount)),
                onChatDeleted: async () => await getCounter().add(ctx, uid, calculator.onChatDeleted(await chatUnread, await isMuted)),
                onMuteChange: async () => {
                    console.log(777, await isMuted);
                    return await getCounter().add(ctx, uid, calculator.onMuteChange(await chatUnread, await isMuted));
                },
                calcForChat: async () => await getCounter().add(ctx, uid, calculator.calcForChat(await chatUnread, await isMuted)),
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
    inContext: (ctx: Context, uid: number, cid: number) => {
        return {
            onMessageReceived: async () => await Promise.all(CounterStrategies.map(s => s.inContext(ctx, uid, cid).onMessageReceived())),
            onMessageDeleted: async () => await Promise.all(CounterStrategies.map(s => s.inContext(ctx, uid, cid).onMessageDeleted())),
            onMessageRead: async (readCount: number) => await Promise.all(CounterStrategies.map(s => s.inContext(ctx, uid, cid).onMessageRead(readCount))),
            onChatDeleted: async () => await Promise.all(CounterStrategies.map(s => s.inContext(ctx, uid, cid).onMessageDeleted())),
            onMuteChange: async () => await Promise.all(CounterStrategies.map(s => s.inContext(ctx, uid, cid).onMuteChange())),
            calcForChat: async () => await Promise.all(CounterStrategies.map(s => s.inContext(ctx, uid, cid).calcForChat())),
        };
    }
};