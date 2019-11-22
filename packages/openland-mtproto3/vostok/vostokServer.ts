import { MessageShape } from '../vostok-schema/VostokTypes';
import * as http from 'http';
import * as https from 'https';
import { createNamedContext } from '@openland/context';
import { asyncRun } from '../utils';
import { createLogger } from '@openland/log';
import { VostokConnection } from './VostokConnection';
import { VostokSession } from './VostokSession';
import { VostokSessionsManager } from './VostokSessionsManager';
import { authorizeConnection } from './authorizeConnection';
import { createWSServer } from './createWSServer';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

export const PING_TIMEOUT = 1000 * 30;
export const PING_CLOSE_TIMEOUT = 1000 * 60 * 5;
export const EMPTY_SESSION_TTL = 1000 * 5;

function handleSession(session: VostokSession, params: VostokServerParams) {
    asyncRun(async () => {
        for await (let data of session.incomingMessages) {
            let {message, connection} = data;

            if (session.state !== 'active') {
                session.destroy();
            } else {
                await params.onMessage({ message, connection, session });
            }
        }
        session.destroy();
    });
}

export type VostokIncomingMessage = { message: MessageShape, connection: VostokConnection, session: VostokSession };

export interface VostokServerParams {
    server?: http.Server | https.Server;
    path: string;

    onAuth(token: string): Promise<any>;

    onMessage(data: VostokIncomingMessage): Promise<void>;
}

export function initVostokServer(params: VostokServerParams) {
    let server = createWSServer(params.server ? { server: params.server, path: params.path } : { noServer: true });
    let sessionsManager = new VostokSessionsManager();
    log.log(rootCtx, 'Lift off!');

    asyncRun(async () => {
        for await (let connect of server.incomingConnections) {
            asyncRun(async () => {
                let session = await authorizeConnection(params, connect, sessionsManager);
                if (!session) {
                    return;
                }
                handleSession(session, params);
            });
        }
    });
    return server.socket;
}