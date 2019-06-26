// THIS FILE IS AUTOGENERATED! DO NOT TRY TO EDIT!
// @ts-ignore
import { Context } from '@openland/context';
// @ts-ignore
import { Subspace } from '@openland/foundationdb';
// @ts-ignore
import { EntityStorage, BaseStore } from '@openland/foundationdb-entity';
// @ts-ignore
import { AtomicIntegerFactory, AtomicBooleanFactory } from '@openland/foundationdb-entity';

export class UserCounterFactory extends AtomicIntegerFactory {

    static async open(storage: EntityStorage) {
        let directory = await storage.resolveAtomicDirectory('userCounter');
        return new UserCounterFactory(storage, directory);
    }

    private constructor(storage: EntityStorage, subspace: Subspace) {
        super(storage, subspace);
    }

    byId(uid: number) {
        return this._findById([uid]);
    }

    get(ctx: Context, uid: number) {
        return this._get(ctx, [uid]);
    }

    set(ctx: Context, uid: number, value: number) {
        return this._set(ctx, [uid], value);
    }

    add(ctx: Context, uid: number, value: number) {
        return this._add(ctx, [uid], value);
    }

    increment(ctx: Context, uid: number) {
        return this._increment(ctx, [uid]);
    }

    decrement(ctx: Context, uid: number) {
        return this._decrement(ctx, [uid]);
    }
}

export class UserMessagesSentCounterFactory extends AtomicIntegerFactory {

    static async open(storage: EntityStorage) {
        let directory = await storage.resolveAtomicDirectory('userMessagesSentCounter');
        return new UserMessagesSentCounterFactory(storage, directory);
    }

    private constructor(storage: EntityStorage, subspace: Subspace) {
        super(storage, subspace);
    }

    byId(uid: number) {
        return this._findById([uid]);
    }

    get(ctx: Context, uid: number) {
        return this._get(ctx, [uid]);
    }

    set(ctx: Context, uid: number, value: number) {
        return this._set(ctx, [uid], value);
    }

    add(ctx: Context, uid: number, value: number) {
        return this._add(ctx, [uid], value);
    }

    increment(ctx: Context, uid: number) {
        return this._increment(ctx, [uid]);
    }

    decrement(ctx: Context, uid: number) {
        return this._decrement(ctx, [uid]);
    }
}

export class UserMessagesSentInDirectChatCounterFactory extends AtomicIntegerFactory {

    static async open(storage: EntityStorage) {
        let directory = await storage.resolveAtomicDirectory('userMessagesSentInDirectChatCounter');
        return new UserMessagesSentInDirectChatCounterFactory(storage, directory);
    }

    private constructor(storage: EntityStorage, subspace: Subspace) {
        super(storage, subspace);
    }

    byId(uid: number) {
        return this._findById([uid]);
    }

    get(ctx: Context, uid: number) {
        return this._get(ctx, [uid]);
    }

    set(ctx: Context, uid: number, value: number) {
        return this._set(ctx, [uid], value);
    }

    add(ctx: Context, uid: number, value: number) {
        return this._add(ctx, [uid], value);
    }

    increment(ctx: Context, uid: number) {
        return this._increment(ctx, [uid]);
    }

    decrement(ctx: Context, uid: number) {
        return this._decrement(ctx, [uid]);
    }
}

export class UserMessagesReceivedCounterFactory extends AtomicIntegerFactory {

    static async open(storage: EntityStorage) {
        let directory = await storage.resolveAtomicDirectory('userMessagesReceivedCounter');
        return new UserMessagesReceivedCounterFactory(storage, directory);
    }

    private constructor(storage: EntityStorage, subspace: Subspace) {
        super(storage, subspace);
    }

    byId(uid: number) {
        return this._findById([uid]);
    }

    get(ctx: Context, uid: number) {
        return this._get(ctx, [uid]);
    }

    set(ctx: Context, uid: number, value: number) {
        return this._set(ctx, [uid], value);
    }

    add(ctx: Context, uid: number, value: number) {
        return this._add(ctx, [uid], value);
    }

    increment(ctx: Context, uid: number) {
        return this._increment(ctx, [uid]);
    }

    decrement(ctx: Context, uid: number) {
        return this._decrement(ctx, [uid]);
    }
}

export class UserMessagesChatsCounterFactory extends AtomicIntegerFactory {

    static async open(storage: EntityStorage) {
        let directory = await storage.resolveAtomicDirectory('userMessagesChatsCounter');
        return new UserMessagesChatsCounterFactory(storage, directory);
    }

    private constructor(storage: EntityStorage, subspace: Subspace) {
        super(storage, subspace);
    }

    byId(uid: number) {
        return this._findById([uid]);
    }

    get(ctx: Context, uid: number) {
        return this._get(ctx, [uid]);
    }

    set(ctx: Context, uid: number, value: number) {
        return this._set(ctx, [uid], value);
    }

    add(ctx: Context, uid: number, value: number) {
        return this._add(ctx, [uid], value);
    }

    increment(ctx: Context, uid: number) {
        return this._increment(ctx, [uid]);
    }

    decrement(ctx: Context, uid: number) {
        return this._decrement(ctx, [uid]);
    }
}

export class UserMessagesDirectChatsCounterFactory extends AtomicIntegerFactory {

    static async open(storage: EntityStorage) {
        let directory = await storage.resolveAtomicDirectory('userMessagesDirectChatsCounter');
        return new UserMessagesDirectChatsCounterFactory(storage, directory);
    }

    private constructor(storage: EntityStorage, subspace: Subspace) {
        super(storage, subspace);
    }

    byId(uid: number) {
        return this._findById([uid]);
    }

    get(ctx: Context, uid: number) {
        return this._get(ctx, [uid]);
    }

    set(ctx: Context, uid: number, value: number) {
        return this._set(ctx, [uid], value);
    }

    add(ctx: Context, uid: number, value: number) {
        return this._add(ctx, [uid], value);
    }

    increment(ctx: Context, uid: number) {
        return this._increment(ctx, [uid]);
    }

    decrement(ctx: Context, uid: number) {
        return this._decrement(ctx, [uid]);
    }
}

export class UserSuccessfulInvitesCounterFactory extends AtomicIntegerFactory {

    static async open(storage: EntityStorage) {
        let directory = await storage.resolveAtomicDirectory('userSuccessfulInvitesCounter');
        return new UserSuccessfulInvitesCounterFactory(storage, directory);
    }

    private constructor(storage: EntityStorage, subspace: Subspace) {
        super(storage, subspace);
    }

    byId(uid: number) {
        return this._findById([uid]);
    }

    get(ctx: Context, uid: number) {
        return this._get(ctx, [uid]);
    }

    set(ctx: Context, uid: number, value: number) {
        return this._set(ctx, [uid], value);
    }

    add(ctx: Context, uid: number, value: number) {
        return this._add(ctx, [uid], value);
    }

    increment(ctx: Context, uid: number) {
        return this._increment(ctx, [uid]);
    }

    decrement(ctx: Context, uid: number) {
        return this._decrement(ctx, [uid]);
    }
}

export class UserDialogCounterFactory extends AtomicIntegerFactory {

    static async open(storage: EntityStorage) {
        let directory = await storage.resolveAtomicDirectory('userDialogCounter');
        return new UserDialogCounterFactory(storage, directory);
    }

    private constructor(storage: EntityStorage, subspace: Subspace) {
        super(storage, subspace);
    }

    byId(uid: number, cid: number) {
        return this._findById([uid, cid]);
    }

    get(ctx: Context, uid: number, cid: number) {
        return this._get(ctx, [uid, cid]);
    }

    set(ctx: Context, uid: number, cid: number, value: number) {
        return this._set(ctx, [uid, cid], value);
    }

    add(ctx: Context, uid: number, cid: number, value: number) {
        return this._add(ctx, [uid, cid], value);
    }

    increment(ctx: Context, uid: number, cid: number) {
        return this._increment(ctx, [uid, cid]);
    }

    decrement(ctx: Context, uid: number, cid: number) {
        return this._decrement(ctx, [uid, cid]);
    }
}

export class UserDialogHaveMentionFactory extends AtomicBooleanFactory {

    static async open(storage: EntityStorage) {
        let directory = await storage.resolveAtomicDirectory('userDialogHaveMention');
        return new UserDialogHaveMentionFactory(storage, directory);
    }

    private constructor(storage: EntityStorage, subspace: Subspace) {
        super(storage, subspace);
    }

    byId(uid: number, cid: number) {
        return this._findById([uid, cid]);
    }

    get(ctx: Context, uid: number, cid: number) {
        return this._get(ctx, [uid, cid]);
    }

    set(ctx: Context, uid: number, cid: number, value: boolean) {
        return this._set(ctx, [uid, cid], value);
    }

    invert(ctx: Context, uid: number, cid: number) {
        return this._invert(ctx, [uid, cid]);
    }
}

export class NotificationCenterCounterFactory extends AtomicIntegerFactory {

    static async open(storage: EntityStorage) {
        let directory = await storage.resolveAtomicDirectory('notificationCenterCounter');
        return new NotificationCenterCounterFactory(storage, directory);
    }

    private constructor(storage: EntityStorage, subspace: Subspace) {
        super(storage, subspace);
    }

    byId(ncid: number) {
        return this._findById([ncid]);
    }

    get(ctx: Context, ncid: number) {
        return this._get(ctx, [ncid]);
    }

    set(ctx: Context, ncid: number, value: number) {
        return this._set(ctx, [ncid], value);
    }

    add(ctx: Context, ncid: number, value: number) {
        return this._add(ctx, [ncid], value);
    }

    increment(ctx: Context, ncid: number) {
        return this._increment(ctx, [ncid]);
    }

    decrement(ctx: Context, ncid: number) {
        return this._decrement(ctx, [ncid]);
    }
}

export class UserAudienceCounterFactory extends AtomicIntegerFactory {

    static async open(storage: EntityStorage) {
        let directory = await storage.resolveAtomicDirectory('userAudienceCounter');
        return new UserAudienceCounterFactory(storage, directory);
    }

    private constructor(storage: EntityStorage, subspace: Subspace) {
        super(storage, subspace);
    }

    byId(uid: number) {
        return this._findById([uid]);
    }

    get(ctx: Context, uid: number) {
        return this._get(ctx, [uid]);
    }

    set(ctx: Context, uid: number, value: number) {
        return this._set(ctx, [uid], value);
    }

    add(ctx: Context, uid: number, value: number) {
        return this._add(ctx, [uid], value);
    }

    increment(ctx: Context, uid: number) {
        return this._increment(ctx, [uid]);
    }

    decrement(ctx: Context, uid: number) {
        return this._decrement(ctx, [uid]);
    }
}

export interface Store extends BaseStore {
    readonly UserCounter: UserCounterFactory;
    readonly UserMessagesSentCounter: UserMessagesSentCounterFactory;
    readonly UserMessagesSentInDirectChatCounter: UserMessagesSentInDirectChatCounterFactory;
    readonly UserMessagesReceivedCounter: UserMessagesReceivedCounterFactory;
    readonly UserMessagesChatsCounter: UserMessagesChatsCounterFactory;
    readonly UserMessagesDirectChatsCounter: UserMessagesDirectChatsCounterFactory;
    readonly UserSuccessfulInvitesCounter: UserSuccessfulInvitesCounterFactory;
    readonly UserDialogCounter: UserDialogCounterFactory;
    readonly UserDialogHaveMention: UserDialogHaveMentionFactory;
    readonly NotificationCenterCounter: NotificationCenterCounterFactory;
    readonly UserAudienceCounter: UserAudienceCounterFactory;
}

export async function openStore(storage: EntityStorage): Promise<Store> {
    let UserCounterPromise = UserCounterFactory.open(storage);
    let UserMessagesSentCounterPromise = UserMessagesSentCounterFactory.open(storage);
    let UserMessagesSentInDirectChatCounterPromise = UserMessagesSentInDirectChatCounterFactory.open(storage);
    let UserMessagesReceivedCounterPromise = UserMessagesReceivedCounterFactory.open(storage);
    let UserMessagesChatsCounterPromise = UserMessagesChatsCounterFactory.open(storage);
    let UserMessagesDirectChatsCounterPromise = UserMessagesDirectChatsCounterFactory.open(storage);
    let UserSuccessfulInvitesCounterPromise = UserSuccessfulInvitesCounterFactory.open(storage);
    let UserDialogCounterPromise = UserDialogCounterFactory.open(storage);
    let UserDialogHaveMentionPromise = UserDialogHaveMentionFactory.open(storage);
    let NotificationCenterCounterPromise = NotificationCenterCounterFactory.open(storage);
    let UserAudienceCounterPromise = UserAudienceCounterFactory.open(storage);
    let UserCounter = await UserCounterPromise;
    let UserMessagesSentCounter = await UserMessagesSentCounterPromise;
    let UserMessagesSentInDirectChatCounter = await UserMessagesSentInDirectChatCounterPromise;
    let UserMessagesReceivedCounter = await UserMessagesReceivedCounterPromise;
    let UserMessagesChatsCounter = await UserMessagesChatsCounterPromise;
    let UserMessagesDirectChatsCounter = await UserMessagesDirectChatsCounterPromise;
    let UserSuccessfulInvitesCounter = await UserSuccessfulInvitesCounterPromise;
    let UserDialogCounter = await UserDialogCounterPromise;
    let UserDialogHaveMention = await UserDialogHaveMentionPromise;
    let NotificationCenterCounter = await NotificationCenterCounterPromise;
    let UserAudienceCounter = await UserAudienceCounterPromise;
    return {
        storage,
        UserCounter,
        UserMessagesSentCounter,
        UserMessagesSentInDirectChatCounter,
        UserMessagesReceivedCounter,
        UserMessagesChatsCounter,
        UserMessagesDirectChatsCounter,
        UserSuccessfulInvitesCounter,
        UserDialogCounter,
        UserDialogHaveMention,
        NotificationCenterCounter,
        UserAudienceCounter,
    };
}
