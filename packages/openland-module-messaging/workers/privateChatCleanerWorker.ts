import { WorkQueue } from '../../openland-module-workers/WorkQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { inTx } from '@openland/foundationdb';
import { Modules } from '../../openland-modules/Modules';
import { Store } from '../../openland-module-db/FDB';

export function createPrivateChatCleanerWorker() {
    let queue = new WorkQueue<{ cid: number, uid: number, oneSide: boolean }>('private_chat_clear');
    if (serverRoleEnabled('workers')) {
        for (let i = 0; i < 10; i++) {
            queue.addWorker(async (task, root) => {
                return await inTx(root, async ctx => {
                    let chat = await Store.ConversationPrivate.findById(ctx, task.cid);
                    if (!chat) {
                        return;
                    }

                    let members = [chat.uid1, chat.uid2];
                    let privateVisibleFor = members;
                    if (task.oneSide) {
                        privateVisibleFor = members.filter(id => id !== task.uid);
                    } else {
                        privateVisibleFor = [];
                    }

                    let clusters: string[] = Modules.Search.elastic.clusters;
                    for (let cluster of clusters) {
                        let client = Modules.Search.elastic.getWritableClient(cluster)!;
                        if (!client) {
                            continue;
                        }

                        let clauses: any[] = [
                            {term: {cid: task.cid}},
                        ];

                        let script = `ctx._source.privateVisibleFor = ${JSON.stringify(privateVisibleFor)};`;
                        await client.updateByQuery({
                            index: 'message',
                            type: 'message',
                            body: {
                                query: {bool: {must: clauses}},
                                script
                            }
                        });
                    }
                });
            });
        }
    }
    return queue;
}