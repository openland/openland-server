import { createIterator } from '../../openland-utils/asyncIterator';
import { VostokConnection } from './VostokConnection';
import WebSocket = require('ws');
import { VostokWSSocket } from './VostokSocket';

export function createWSServer(options: WebSocket.ServerOptions) {
    const ws = new WebSocket.Server(options);
    let iterator = createIterator<VostokConnection>(() => 0);
    ws.on('connection', async (socket, req) => {
        let connection = new VostokConnection();
        connection.setSocket(new VostokWSSocket(socket));
        iterator.push(connection);
    });

    return {
        socket: ws,
        incomingConnections: iterator
    };
}