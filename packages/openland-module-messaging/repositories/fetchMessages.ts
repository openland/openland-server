import { Comment, Message, PrivateMessage, RichMessage } from '../../openland-module-db/store';
import { Context } from '@openland/context';
import { RangeQueryOptions } from '@openland/foundationdb-entity';
import { Store } from '../../openland-module-db/FDB';

export function isMessageHiddenForUser(message: Message | PrivateMessage | Comment | RichMessage, forUid: number) {
    if (!(message instanceof Message)) {
        return false;
    }
    if (message.visibleOnlyForUids && message.visibleOnlyForUids.length > 0 && !message.visibleOnlyForUids.includes(forUid)) {
        return true;
    }
    return false;
}

async function fetchMessagesRaw(ctx: Context, cid: number, forUid: number, opts: RangeQueryOptions<number>) {
    let privateChat = await Store.ConversationPrivate.findById(ctx, cid);
    if (!privateChat || privateChat.uid1 === privateChat.uid2) {
        return await Store.Message.chat.query(ctx, cid, opts);
    } else {
        return await Store.PrivateMessage.chat.query(ctx, cid, forUid, opts);
    }
}

export async function fetchMessages(ctx: Context, cid: number, forUid: number, opts: RangeQueryOptions<number>) {
    let messages = await fetchMessagesRaw(ctx, cid, forUid, opts);
    if (messages.items.length === 0) {
        return messages;
    }
    let after = messages.items[messages.items.length - 1].id;
    messages.items = (messages.items as any).filter((m: any) => (m.visibleOnlyForUids && m.visibleOnlyForUids.length > 0) ? m.visibleOnlyForUids.includes(forUid) : true);

    while (messages.items.length < (opts.limit || 0) && messages.haveMore) {
        let more = await fetchMessagesRaw(ctx, cid, forUid, { ...opts, after, limit: 1 });
        // let more = await Store.Message.chat.query(ctx, cid, { ...opts, after, limit: 1 });
        if (more.items.length === 0) {
            messages.haveMore = false;
            return messages;
        }
        after = more.items[more.items.length - 1].id;

        let filtered = (more.items as any).filter((m: any) => (m.visibleOnlyForUids && m.visibleOnlyForUids.length > 0) ? m.visibleOnlyForUids.includes(forUid) : true);
        messages.items.push(...filtered);
        messages.haveMore = more.haveMore;
        messages.cursor = more.cursor;
    }
    if (opts.limit) {
        messages.items = messages.items.slice(0, opts.limit);
    }

    return messages;
}