//
// Ends Voice chats with no peers
// Probably the bug is on client side (voice chat join is called, but conferenceJoin is not)
//
import { singletonWorker } from '@openland/foundationdb-singleton';
import { Store } from '../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Modules } from '../../openland-modules/Modules';

export function startVoiceChatsCleanupWorker() {
    singletonWorker({db: Store.storage.db, name: 'call-reaper', delay: 1000}, async (parent) => {
        let activeVoiceChats = await inTx(parent, async ctx => Store.ConversationVoice.active.findAll(ctx));

        for (let voiceChat of activeVoiceChats) {
            await inTx(parent, async ctx => {
                let peers = await Store.ConferencePeer.conference.findAll(ctx, voiceChat.id);
                if (peers.length > 0) {
                    return;
                }
                await Modules.VoiceChats.chats.endChat(ctx, voiceChat.startedBy!, voiceChat.id);
            });
        }
    });
}