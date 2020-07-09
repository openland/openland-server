import WebSocket from 'ws';
import { GQlServerOperation, SpaceXServerParams } from './spaceXServerParams';
import { Shutdown } from '../openland-utils/Shutdown';
import { SpaceXConnection } from './SpaceXConnection';
import http from 'http';
import {
    ConnectionInitCodec,
    decode,
    PingMessageCodec,
    PongMessageCodec,
    StartMessageCodec,
    StopMessageCodec
} from './types';
import { SpaceXSession, SpaceXSessionDescriptor } from './SpaceXSession';
import { parse } from 'graphql';
import { PingPong } from './PingPong';
import { delay } from '../openland-utils/timer';
import { asyncRun } from './utils/asyncRun';
import { EventBus } from '../openland-module-pubsub/EventBus';

export const SpaceXConnections = new Map<string, SpaceXConnection>();

async function handleAuth(params: SpaceXServerParams, req: http.IncomingMessage, connection: SpaceXConnection, message: unknown) {
    let authReq = decode(ConnectionInitCodec, message);
    if (!authReq) {
        connection.close();
        return;
    }
    if (authReq.protocol_v) {
        if (authReq.protocol_v > 2 || authReq.protocol_v < 1) {
            connection.close();
            return;
        }
        connection.protocolVersion = authReq.protocol_v;
    }

    connection.setConnecting();
    connection.authParams = await params.onAuth(authReq.payload, req);
    connection.sendConnectionAck();

    // Create SpaceX Session
    let descriptor: SpaceXSessionDescriptor;
    if (connection.authParams.uid) {
        descriptor = { type: 'authenticated', uid: connection.authParams.uid, tid: connection.authParams.tid };
    } else {
        descriptor = { type: 'anonymnous' };
    }
    connection.session = new SpaceXSession({
        descriptor,
        schema: params.executableSchema
    });

    // Keep alive loop
    asyncRun(async () => {
        while (connection.isConnected()) {
            // Close connection by timout
            if (Date.now() - connection.lastRequestTime > 1000 * 60 * 60) {
                connection.close();
            }
            connection.sendKeepAlive();
            await delay(5000);
        }
    });

    if (connection.protocolVersion === 2) {
        connection.pinger = new PingPong(connection);
        connection.pinger.start();
    }

    connection.setConnected();
}

async function handleOperation(params: SpaceXServerParams, req: http.IncomingMessage, connection: SpaceXConnection, operation: GQlServerOperation, id: string) {
    let ctx = await params.context(connection.authParams, operation, req);
    if (!connection.operationBucket.tryTake()) {
        // handle error
        connection.sendRateLimitError(id);
        connection.sendComplete(id);
        connection.stopOperation(id);
        return;
    }
    await params.onOperation(ctx, operation);
    let opStartTime = Date.now();
    let query = parse(operation.query);
    let op = connection.session.operation(ctx, { document: query, variables: operation.variables, operationName: operation.name }, (res) => {
        if (res.type === 'data') {
            connection.sendData(id, params.formatResponse({ data: res.data }, operation, ctx));
        } else if (res.type === 'errors') {
            connection.sendData(id, params.formatResponse({ errors: res.errors }, operation, ctx));
        } else if (res.type === 'completed') {
            connection.sendComplete(id);
            params.onOperationFinish(ctx, operation, Date.now() - opStartTime);
        }
    });
    connection.addOperation(id, () => op.cancel());
}

async function handleMessage(params: SpaceXServerParams, socket: WebSocket, req: http.IncomingMessage, connection: SpaceXConnection, message: unknown) {
    if (connection.state === 'init') {
        await handleAuth(params, req, connection, message);
    } else if (connection.state === 'connected' || connection.state === 'connecting') {
        await connection.waitAuth();
        connection.lastRequestTime = Date.now();

        let startOp = decode(StartMessageCodec, message);
        if (startOp) {
            await handleOperation(params, req, connection, startOp.payload, startOp.id);
        }

        let stopOp = decode(StopMessageCodec, message);
        if (stopOp) {
            connection.stopOperation(stopOp.id);
        }

        let ping = decode(PingMessageCodec, message);
        if (ping) {
            connection.pinger?.onPing();
        }

        let pong = decode(PongMessageCodec, message);
        if (pong) {
            connection.pinger?.onPong();
        }
    }
}

async function handleConnection(params: SpaceXServerParams, socket: WebSocket, req: http.IncomingMessage) {
    let connection = new SpaceXConnection(socket, () => {
        SpaceXConnections.delete(connection.id);
    });
    SpaceXConnections.set(connection.id, connection);

    socket.on('message', async data => {
        try {
            await handleMessage(params, socket, req, connection, JSON.parse(data.toString()));
        } catch (e) {
            connection.close();
        }
    });
    socket.on('close', (code, reason) => {
        connection.close();
    });
    socket.on('error', (err) => {
        connection.close();
    });
}

export async function createSpaceXServer(params: SpaceXServerParams) {
    let working = true;
    const ws = new WebSocket.Server(params.server ? { server: params.server, path: params.path } : { noServer: true });
    ws.on('connection', async (socket, req) => {
        await handleConnection(params, socket, req);
    });

    //
    // Close connections by timeout if there was no auth yet
    //
    asyncRun(async () => {
        while (working) {
            for (let [, connection] of SpaceXConnections.entries()) {
                if (!connection.isConnected() && (Date.now() - connection.createdAt) > 1000 * 60) {
                    connection.close();
                }
            }
            await delay(1000 * 60);
        }
    });

    EventBus.subscribe('auth_token_revoke', (data: { tokens: { uuid: string, salt: string }[] }) => {
        for (let token of data.tokens) {
            for (let entry of SpaceXConnections.entries()) {
                let [, session] = entry;
                if (session.authParams && session.authParams.tid && session.authParams.tid === token.uuid) {
                    session.close();
                }
            }
        }
    });

    Shutdown.registerWork({
        name: 'spacex-server',
        shutdown: async () => {
            working = false;
            ws.close();
        }
    });
    return { ws, connections: SpaceXConnections };
}