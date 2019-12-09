import { VostokConnection } from './VostokConnection';
import { VostokSessionsManager } from './VostokSessionsManager';
import { makeMessageId } from '../utils';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { BaseVostokServerParams, VostokTypeUrls } from './vostokServer';
import { vostok } from './schema/schema';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

export async function authorizeConnection(serverParams: BaseVostokServerParams, connection: VostokConnection, sessionsManager: VostokSessionsManager) {
    let state = 'init';
    for await (let message of connection.getIncomingMessagesIterator()) {
        if (!(message instanceof vostok.Message)) {
            continue;
        }

        if (state === 'init' && message.body.type_url !== VostokTypeUrls.Initialize) {
            log.log(rootCtx, 'auth error, closing connection');
            connection.close();
            return null;
        } else if (state === 'init' && message.body.type_url === VostokTypeUrls.Initialize) {
            let initialize = vostok.Initialize.decode(message.body.value!);
            state = 'waiting_auth';
            let authParams = await serverParams.onAuth(initialize.authToken || '');
            state = 'connected';
            if (initialize.sessionId) {
                let target = sessionsManager.get(initialize.sessionId);
                if (target) {
                    log.log(rootCtx, 'switch to session #', target.sessionId);
                    target.addConnection(connection);
                    connection.sendBuff(vostok.TopMessage.encode({
                        message: {
                            id: makeMessageId(),
                            body: {
                                type_url: VostokTypeUrls.InitializeAck,
                                value: vostok.InitializeAck.encode({sessionId: target.sessionId}).finish()
                            },
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
                    body: {
                        type_url: VostokTypeUrls.InitializeAck,
                        value: vostok.InitializeAck.encode({sessionId: session.sessionId}).finish()
                    },
                    ackMessages: [message.id]
                }
            }).finish());
            return session;
        }
    }
    return null;
}