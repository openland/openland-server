import { broker } from '../../openland-server/moleculer';
import { createRemoteObservable } from '../../openland-module-pubsub/createRemoteStream';
import { createNamedContext } from '@openland/context';
import { OnlineEvent } from '../PresenceModule';
import { Modules } from '../../openland-modules/Modules';

let rootCtx = createNamedContext('presence');
export function registerPresenceService() {
    broker.createService({
        name: 'presence',
        actions: {
            chatPresenceStream: {
                name: 'chatPresenceStream',
                strategy: 'Shard',
                strategyOptions: {
                    shardKey: 'chatId'
                },
                handler: createRemoteObservable<{ uid: number, chatId: number }, OnlineEvent>(rootCtx, async (root, { uid, chatId }) => {
                    return Modules.Presence.createChatPresenceStream(uid, chatId);
                })
            },
            chatOnlineCountStream: {
                name: 'chatOnlineCountStream',
                strategy: 'Shard',
                strategyOptions: {
                    shardKey: 'chatId'
                },
                handler: createRemoteObservable<{ uid: number, chatId: number }, { onlineMembers: number }>(rootCtx, async (root, { uid, chatId }) => {
                    return Modules.Presence.createChatOnlineCountStream(uid, chatId);
                })
            }
        }
    });
}