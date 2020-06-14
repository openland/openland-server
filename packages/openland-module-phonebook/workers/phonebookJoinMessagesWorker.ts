import { Store } from '../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Modules } from '../../openland-modules/Modules';
import { WorkQueue } from '../../openland-module-workers/WorkQueue';

export function createPhonebookJoinMessagesWorker() {
    let worker = new WorkQueue<{ uid: number }>('phonebook_join_message');
    return worker;
}

export function addPhonebookJoinMessagesWorker(worker: WorkQueue<{ uid: number }>) {
    worker.addWorker(async (item, parent) => {
        return await inTx(parent, async (ctx) => {
            let user = await Store.User.findById(ctx, item.uid);
            let profile = await Store.UserProfile.findById(ctx, item.uid);

            if (!user || !profile) {
                return;
            }
            if (!user.phone) {
                return;
            }

            let sentAlready = await Store.PhonebookJoinMessageSentForPhone.get(ctx, user.phone);
            if (sentAlready) {
                return;
            }

            let hits = await Modules.Search.elastic.client.search({
                index: 'phonebook',
                type: 'phonebook',
                body: {
                    query: {
                        bool: {
                            must: [{ match_phrase_prefix: { phones: user.phone } }]
                        }
                    },
                },
            });

            let sentUsers = new Set<number>();
            for (let hit of hits.hits.hits) {
                let uid = (hit._source as any).uid;
                if (uid === item.uid) {
                    continue;
                }
                if (sentUsers.has(uid)) {
                    continue;
                }

                let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, uid, user.id);
                let name = await Modules.Users.getUserFullName(ctx, item.uid);
                await Modules.Messaging.sendMessage(ctx, chat.id, user.id, { isService: true, message: `${name} joined Openland`, hiddenForUids: [user.id] });
                sentUsers.add(uid);
            }

            await Store.PhonebookJoinMessageSentForPhone.set(ctx, user.phone, true);
        });
    });
}
