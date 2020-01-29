import { VostokConnection } from './VostokConnection';
import { VostokSessionsManager } from './VostokSessionsManager';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { BaseVostokServerParams, VostokTypes } from './vostokServer';
import { vostok } from './schema/schema';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

export async function authorizeConnection(serverParams: BaseVostokServerParams, connection: VostokConnection, sessionsManager: VostokSessionsManager) {
    let state = 'init';
    for await (let message of connection.getIncomingMessagesIterator()) {
        if (!(message instanceof vostok.Message)) {
            continue;
        }

        if (state === 'init' && message.bodyType !== VostokTypes.Initialize) {
            log.log(rootCtx, 'auth error, closing connection');
            connection.close();
            return null;
        } else if (state === 'init' && message.bodyType === VostokTypes.Initialize) {
            let initialize = vostok.Initialize.decode(message.body);
            state = 'waiting_auth';
            let authParams = await serverParams.onAuth(initialize.authToken || '');
            state = 'connected';
            if (initialize.sessionId) {
                let target = sessionsManager.get(initialize.sessionId);
                if (target) {
                    log.log(rootCtx, 'switch to session #', target.sessionId);
                    target.addConnection(connection);
                    // Force session to send ack to this connection
                    connection.lastPingAck = Date.now();
                    target.send({
                        bodyType: VostokTypes.InitializeAck,
                        body: vostok.InitializeAck.encode({sessionId: target.sessionId}).finish(),
                        ackMessages: [message.id]
                    });
                    return target;
                }
            }
            let session = sessionsManager.newSession();
            log.log(rootCtx, 'new session #', session.sessionId);
            session.addConnection(connection);
            session.authParams = authParams;
            // Force session to send ack to this connection
            connection.lastPingAck = Date.now();
            session.send({
                bodyType: VostokTypes.InitializeAck,
                body: vostok.InitializeAck.encode({sessionId: session.sessionId}).finish(),
                ackMessages: [message.id]
            });
            return session;
        }
    }
    return null;
}
