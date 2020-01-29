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
import { vostok } from './schema/schema';
import { createTCPServer } from './createTCPServer';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

export const PING_TIMEOUT = 1000 * 30;
export const PING_CLOSE_TIMEOUT = 1000 * 60 * 5;
export const EMPTY_SESSION_TTL = 1000 * 5;
export const MESSAGE_INFO_REQ_TIMEOUT = 1000 * 5;

export type TopLevelMessages =
    vostok.IMessage |
    vostok.IAckMessages |
    vostok.IMessagesInfoRequest |
    vostok.IResendMessageAnswerRequest |
    vostok.IMessageNotFoundResponse;

export const VostokTypes = {
    Initialize: 1,
    InitializeAck: 2
};

function handleSession(session: VostokSession, params: BaseVostokServerParams) {
    asyncRun(async () => {
        for await (let data of session.incomingMessages) {
            let {message, connection} = data;

            if (session.state !== 'active') {
                session.destroy();
            } else {
                await params.onMessage({message, connection, session});
            }
        }
        session.destroy();
    });
}

export type VostokIncomingMessage = { message: vostok.IMessage, connection: VostokConnection, session: VostokSession };

export interface BaseVostokServerParams {
    onAuth(token: string): Promise<any>;

    onMessage(data: VostokIncomingMessage): Promise<void>;
}

export type VostokWSServerParams = BaseVostokServerParams & {
    server?: http.Server | https.Server;
    path: string;
};

export function initVostokWSServer(params: VostokWSServerParams) {
    let server = createWSServer(params.server ? {server: params.server, path: params.path} : {noServer: true});
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
    return {ws: server.socket, sessions: sessionsManager};
}

export type VostokTCPServerParams = BaseVostokServerParams & {
    port: number;
    hostname: string;
};

export function initVostokTCPServer(params: VostokTCPServerParams) {
    let server = createTCPServer(params);
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
    return {server: server.server, sessions: sessionsManager};
}
