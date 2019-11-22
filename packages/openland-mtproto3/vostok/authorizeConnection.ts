import { VostokConnection } from './VostokConnection';
import { VostokSessionsManager } from './VostokSessionsManager';
import { encodeMessage, isInitialize, isMessage, makeInitializeAck, makeMessage } from '../vostok-schema/VostokTypes';
import { makeMessageId } from '../utils';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { VostokServerParams } from './vostokServer';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

export async function authorizeConnection(serverParams: VostokServerParams, connection: VostokConnection, sessionsManager: VostokSessionsManager) {
    let state = 'init';
    for await (let message of connection.getIncomingMessagesIterator()) {
        if (!isMessage(message)) {
            continue;
        }

        if (state === 'init' && !isInitialize(message.body)) {
            connection.close();
            return null;
        } else if (state === 'init' && isInitialize(message.body)) {
            state = 'waiting_auth';
            let authParams = await serverParams.onAuth(message.body.authToken);
            state = 'connected';
            if (message.body.sessionId) {
                let target = sessionsManager.get(message.body.sessionId);
                if (target) {
                    log.log(rootCtx, 'switch to session #', target.sessionId);
                    target.addConnection(connection);
                    connection.sendRaw(encodeMessage(makeMessage({
                        id: makeMessageId(),
                        body: makeInitializeAck({ sessionId: target.sessionId }),
                        ackMessages: [message.id]
                    })));
                    return target;
                }
            }
            let session = sessionsManager.newSession();
            log.log(rootCtx, 'new session #', session.sessionId);
            session.addConnection(connection);
            session.authParams = authParams;
            session.send(makeInitializeAck({ sessionId: session.sessionId }), [message.id]);
            return session;
        }
    }
    return null;
}