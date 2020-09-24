import { Store } from '../../openland-module-db/FDB';
import { Context } from '@openland/context';
import { encoders, inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';

@injectable()
export class UserReadSeqsDirectory {
    private directory = Store.UserReadSeqsDirectory
        .withKeyEncoding(encoders.tuple)
        .withValueEncoding(encoders.int32LE);

    onAddDialog = async (parent: Context, uid: number, cid: number) => {
        return inTx(parent, async ctx => {
            let chatLastSeq = await Store.ConversationLastSeq.byId(cid).get(ctx);
            this.directory.set(ctx, [uid, cid], chatLastSeq);
        });
    }

    onRemoveDialog = async (parent: Context, uid: number, cid: number) => {
        return inTx(parent, async ctx => {
            this.directory.clear(ctx, [uid, cid]);
        });
    }

    updateReadSeq = async (parent: Context, uid: number, cid: number, toSeq: number) => {
        return inTx(parent, async ctx => {
            this.directory.set(ctx, [uid, cid], toSeq);
        });
    }

    clearForUser = (ctx: Context, uid: number) => {
        this.directory.clearPrefixed(ctx, [uid]);
    }

    getUserReadSeqs = async (ctx: Context, uid: number) => {
        let userReadSeqs = await this.directory.snapshotRange(ctx, [uid]);
        return userReadSeqs.map(val => ({ cid: val.key[val.key.length - 1] as number, seq: val.value }));
    }

    getUserReadSeqForChat = async (ctx: Context, uid: number, cid: number) => {
        return (await this.directory.get(ctx, [uid, cid])) || 0;
    }
}