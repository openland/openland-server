import * as Net from 'net';
import { createIterator } from '../../openland-utils/asyncIterator';
import { VostokMessageReader } from './VostokMessageReader';
import WebSocket = require('ws');

export abstract class VostokSocket {
    abstract getIterator(): AsyncIterable<Buffer>;
    abstract send(data: Buffer|Uint8Array): void;
    abstract close(): void;
}

export class VostokWSSocket extends VostokSocket {
    protected incomingMessages = createIterator<Buffer>(() => 0);
    private socket: WebSocket;

    constructor(socket: WebSocket) {
        super();

        this.socket = socket;
        socket.on('message', data => {
            if (!(data instanceof Buffer)) {
                socket.close();
                this.incomingMessages.complete();
                return;
            }
            this.incomingMessages.push(data);
        });
        socket.on('close', () => this.incomingMessages.complete());
    }

    getIterator() {
        return this.incomingMessages;
    }

    send(data: Buffer|Uint8Array) {
        this.socket.send(data);
    }

    close() {
        this.socket.close();
        this.incomingMessages.complete();
    }
}

export class VostokRawSocket extends VostokSocket {
    private socket: Net.Socket;
    protected incomingMessages = createIterator<Buffer>(() => 0);
    private reader = new VostokMessageReader((msg) => {
        this.incomingMessages.push(msg);
    });

    constructor(socket: Net.Socket) {
        super();

        this.socket = socket;
        socket.on('close', () => this.incomingMessages.complete());
        socket.on('data', data => {
            try {
                this.reader.addChunk(data);
            } catch (e) {
                this.incomingMessages.complete();
                socket.destroy();
            }
        });
    }

    getIterator() {
        return this.incomingMessages;
    }

    send(data: Buffer|Uint8Array) {
        let header = Buffer.alloc(8);
        header.writeInt32LE(0x77777777, 0);
        header.writeInt32LE(data.length, 4);

        this.socket.write(Buffer.concat([header, data]));
    }

    close() {
        this.socket.end();
        this.incomingMessages.complete();
    }
}