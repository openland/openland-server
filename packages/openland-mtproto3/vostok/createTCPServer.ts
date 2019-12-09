import { createIterator } from '../../openland-utils/asyncIterator';
import { VostokConnection } from './VostokConnection';
import { VostokRawSocket } from './VostokSocket';
import { createServer } from 'net';

export function createTCPServer(options: { port: number, hostname: string }) {
    let iterator = createIterator<VostokConnection>(() => 0);

    const server = createServer((socket) => {
        let connection = new VostokConnection();
        connection.setSocket(new VostokRawSocket(socket));
        iterator.push(connection);
    });
    server.listen(options.port, options.hostname);

    return {
        server,
        incomingConnections: iterator
    };
}