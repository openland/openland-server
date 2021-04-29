//
// Ends Voice chats with no peers
// Probably the bug is on client side (voice chat join is called, but conferenceJoin is not)
//
import { singletonWorker } from '@openland/foundationdb-singleton';
import { Store } from '../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Modules } from '../../openland-modules/Modules';

export function startVoiceChatsCleanupWorker() {
    singletonWorker({db: Store.storage.db, name: 'voice-chats-cleaner', delay: 1000 * 60}, async (parent) => {
        let voiceChats = await inTx(parent, async ctx => Store.ConversationVoice.findAll(ctx));

        for (let voiceChat of voiceChats) {
            if (!voiceChat.active) {
                continue;
            }
            await inTx(parent, async ctx => {
                // Ignore new chats
                if ((Date.now() - voiceChat.metadata.createdAt) < 1000 * 60) {
                    return;
                }
                let peers = await Store.ConferencePeer.conference.findAll(ctx, voiceChat.id);
                if (peers.length > 0) {
                    return;
                }
                let speakers = await Store.VoiceChatParticipant.speakers.findAll(ctx, voiceChat.id);

                if (peers.length === 0 && speakers.length > 0) {
                    await Modules.VoiceChats.chats.endChat(ctx, voiceChat.startedBy!, voiceChat.id);
                }
            });
        }
    });
}