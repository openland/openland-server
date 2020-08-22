import { RegistrationsRepository } from './../repo/RegistrationsRepository';
import { Store } from 'openland-module-db/FDB';
import { SeqRepository } from './../repo/SeqRepository';
import { Context } from '@openland/context';
import { Event, serializeEvent, resolveRepeatKey } from '../Definitions';
import { inTxLeaky, getTransaction } from '@openland/foundationdb';
import { EventsStorage } from 'openland-module-events/repo/EventsStorage';
import { EventBus } from 'openland-module-pubsub/EventBus';

const REFRESH_TIMEOUT = 60 * 60 * 1000; /* 1hr */

export class EventMediator {

    readonly storage: EventsStorage = new EventsStorage(Store.EventStorageDirectory);
    readonly seqRepository: SeqRepository = new SeqRepository(Store.EventUserSeqDirectory);
    readonly registrations: RegistrationsRepository = new RegistrationsRepository(Store.EventRegistrationsDirectory, this.storage);

    //
    // Posting
    //

    postUserEvent = async (parent: Context, uid: number, event: Event) => {
        await inTxLeaky(parent, async (ctx) => {
            let user = await this.registrations.getOrCreateUser(ctx, uid);
            await this.postEventToFeed(ctx, user.common, event);
        });
    }

    postGroupEvent = async (parent: Context, cid: number, event: Event) => {
        await inTxLeaky(parent, async (ctx) => {
            let group = await this.registrations.getOrCreateGroup(ctx, cid);
            await this.postEventToFeed(ctx, group, event);
        });
    }

    postEventToFeed = async (parent: Context, feed: Buffer, event: Event) => {
        await inTxLeaky(parent, async (ctx) => {
            let repeatKey = resolveRepeatKey(event);
            let posted = await this.storage.post(ctx, feed, serializeEvent(event), { repeatKey });
            if (posted.subscribers && posted.subscribers.length > 0) {
                let now = Date.now();

                // Resolving targets
                let targets: { type: 'user', uid: number, seq: number }[] = [];
                for (let subscriber of posted.subscribers) {
                    let source = await this.registrations.getSubscriptionSource(ctx, subscriber);
                    if (!source) {
                        continue;
                    }
                    if (source.type !== 'user') {
                        continue;
                    }
                    let allocatedSeq = await this.seqRepository.allocateSeqIfOnline(ctx, source.uid, now);
                    if (allocatedSeq) {
                        targets.push({ type: 'user', uid: source.uid, seq: allocatedSeq });
                    }
                }

                // Notify
                let resolvedPostId = this.storage.resolvePostId(ctx, posted.index).promise;
                getTransaction(ctx).afterCommit(async () => {
                    let postId = await resolvedPostId;
                    for (let target of targets) {
                        if (target.type === 'user') {
                            EventBus.publish(`events.user.${target.uid}`, {
                                seq: target.seq,
                                fseq: posted.seq,
                                fid: postId.toString('hex')
                            });
                        }
                    }
                });
            }
        });
    }

    //
    // Keep Alive
    //

    refreshOnline = async (ctx: Context, uid: number) => {
        await this.seqRepository.refreshOnline(ctx, uid, Date.now() + REFRESH_TIMEOUT);
    }

    //
    // Hooks
    //

    onUserCreated = async (parent: Context, uid: number) => {
        await inTxLeaky(parent, async (ctx) => {
            await this.registrations.getOrCreateUser(ctx, uid);
        });
    }

    onUserDeleted = async (ctx: Context, uid: number) => {
        // Nothing to do?
    }
}