import { Context } from '@openland/context';
import { encoders, Subspace } from '@openland/foundationdb';
import { Message } from 'openland-module-db/store';
import { getAllMentions, hasAllMention } from 'openland-module-messaging/resolvers/ModernMessage.resolver';
import { CountersDirectory } from './CountersDirectory';

const SUBSPACE_COUNTERS = 0;

export class NewCountersRepository {
    readonly subspace: Subspace;
    readonly counters: CountersDirectory;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
        this.counters = new CountersDirectory(subspace.subspace(encoders.tuple.pack([SUBSPACE_COUNTERS])));
    }

    onMessage = async (ctx: Context, message: Message) => {
        let deleted = !!message.deleted;
        let sender = message.uid;
        let allMention = hasAllMention(message);
        let mentions = getAllMentions(message);
        let visibleOnlyTo = message.visibleOnlyForUids ? message.visibleOnlyForUids : [];
        await this.counters.removeMessage(ctx, [message.cid], message.id); // Remove old broken index
        if (deleted) {
            await this.counters.removeMessage(ctx, [message.cid], message.seq!);
        } else {
            await this.counters.addOrUpdateMessage(ctx, [message.cid], message.seq!, {
                mentions,
                allMention,
                sender,
                visibleOnlyTo
            });
        }
    }
}