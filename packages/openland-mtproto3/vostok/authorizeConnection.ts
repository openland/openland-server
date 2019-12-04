import { VostokConnection } from './VostokConnection';
import { VostokSessionsManager } from './VostokSessionsManager';
import { makeMessageId } from '../utils';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { VostokServerParams } from './vostokServer';
import { vostok } from './schema/schema';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

export async function authorizeConnection(serverParams: VostokServerParams, connection: VostokConnection, sessionsManager: VostokSessionsManager) {
    let state = 'init';
    for await (let message of connection.getIncomingMessagesIterator()) {
        if (!(message instanceof vostok.Message)) {
            continue;
        }

        if (state === 'init' && !message.initialize) {
            connection.close();
            return null;
        } else if (state === 'init' && message.initialize) {
            state = 'waiting_auth';
            let authParams = await serverParams.onAuth(message.initialize.authToken || '');
            state = 'connected';
            if (message.initialize.sessionId) {
                let target = sessionsManager.get(message.initialize.sessionId);
                if (target) {
                    log.log(rootCtx, 'switch to session #', target.sessionId);
                    target.addConnection(connection);
                    connection.sendBuff(vostok.TopMessage.encode({
                        message: {
                            id: makeMessageId(),
                            initializeAck: { sessionId: target.sessionId },
                            ackMessages: [message.id]
                        }
                    }).finish());
                    return target;
                }
            }
            let session = sessionsManager.newSession();
            log.log(rootCtx, 'new session #', session.sessionId);
            session.addConnection(connection);
            session.authParams = authParams;
            connection.sendBuff(vostok.TopMessage.encode({
                message: {
                    id: makeMessageId(),
                    initializeAck: { sessionId: session.sessionId },
                    ackMessages: [message.id]
                }
            }).finish());
            return session;
        }
    }
    return null;
}