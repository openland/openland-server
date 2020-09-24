import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import { encoders, Subspace, TupleItem } from '@openland/foundationdb';
import { injectable } from 'inversify';

const PREFIX_CHAT = 0;
const PREFIX_USER = 1;

const PREFIX_SYNC = 0;
const PREFIX_ASYNC = 1;

@injectable()
export class ChatsMembersListDirectory {
    readonly directory = Store.ChatMembersDirectory;

    private readonly chatSubspace: Subspace<TupleItem[], boolean>;
    private readonly userSubspace: Subspace<TupleItem[], boolean>;

    constructor() {
        this.chatSubspace = this.directory
            .subspace(encoders.tuple.pack([PREFIX_CHAT]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean);

        this.userSubspace = this.directory
            .subspace(encoders.tuple.pack([PREFIX_USER]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean);
    }

    addMember(ctx: Context, cid: number, uid: number, async: boolean) {
        if (async) {
            this.chatSubspace.clear(ctx, [cid, PREFIX_SYNC, uid]);
            this.chatSubspace.set(ctx, [cid, PREFIX_ASYNC, uid], true);

            this.userSubspace.clear(ctx, [uid, PREFIX_SYNC, cid]);
            this.userSubspace.set(ctx, [uid, PREFIX_ASYNC, cid], true);
        } else {
            this.chatSubspace.clear(ctx, [cid, PREFIX_ASYNC, uid]);
            this.chatSubspace.set(ctx, [cid, PREFIX_SYNC, uid], true);

            this.userSubspace.clear(ctx, [uid, PREFIX_ASYNC, cid]);
            this.userSubspace.set(ctx, [uid, PREFIX_SYNC, cid], true);
        }
    }

    removeMember(ctx: Context, cid: number, uid: number) {
        this.chatSubspace.clear(ctx, [cid, PREFIX_SYNC, uid]);
        this.chatSubspace.clear(ctx, [cid, PREFIX_ASYNC, uid]);
        this.userSubspace.clear(ctx, [uid, PREFIX_SYNC, cid]);
        this.userSubspace.clear(ctx, [uid, PREFIX_ASYNC, cid]);
    }

    changeMemberType(ctx: Context, cid: number, uid: number, async: boolean) {
        if (async) {
            this.chatSubspace.clear(ctx, [cid, PREFIX_SYNC, uid]);
            this.chatSubspace.set(ctx, [cid, PREFIX_ASYNC, uid], true);
            this.userSubspace.clear(ctx, [uid, PREFIX_SYNC, cid]);
            this.userSubspace.set(ctx, [uid, PREFIX_ASYNC, cid], true);
        } else {
            this.chatSubspace.clear(ctx, [cid, PREFIX_ASYNC, uid]);
            this.chatSubspace.set(ctx, [cid, PREFIX_SYNC, uid], true);
            this.userSubspace.clear(ctx, [uid, PREFIX_ASYNC, cid]);
            this.userSubspace.set(ctx, [uid, PREFIX_SYNC, cid], true);
        }
    }

    async getChatMembers(ctx: Context, cid: number) {
        let res = await this.chatSubspace.range(ctx, [cid]);
        return res.map(v => ({ type: v.key[1] === PREFIX_SYNC ? 'sync' : 'async', uid: v.key[2] }));
    }

    async getUserChats(ctx: Context, uid: number) {
        let res = await this.userSubspace.range(ctx, [uid]);
        return res.map(v => ({ type: v.key[1] === PREFIX_SYNC ? 'sync' : 'async', cid: v.key[2] as number }));
    }
}