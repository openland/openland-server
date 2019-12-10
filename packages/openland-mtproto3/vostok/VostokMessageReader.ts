function findAtLeastNBytes(chunks: Buffer[], len: number) {
    let res = [];
    let resLen = 0;

    for (let chunk of chunks) {
        res.push(chunk);
        resLen += chunk.length;

        if (resLen >= len) {
            return res;
        }
    }

    return null;
}

function chunksLength(chunks: Buffer[]) {
    let length = 0;
    for (let chunk of chunks) {
        length += chunk.length;
    }
    return length;
}

const MESSAGE_MAGIC = 0x77777777;
const HEADER_SIZE = 8;

class VostokParsingError extends Error {

}

export class VostokMessageReader {
    private onMessage: ((message: Buffer) => void) | null;
    private chunks: Buffer[] = [];
    private chunksLen = 0;
    private state: 'waiting_header' | 'waiting_payload' = 'waiting_header';
    private payloadSize = 0;

    constructor(onMessage: (message: Buffer) => void) {
        this.onMessage = onMessage;
    }

    addChunk(chunk: Buffer) {
        this.chunks.push(chunk);
        this.chunksLen += chunk.length;
        this.parseMessage();
    }

    destroy() {
        this.chunks = [];
        this.onMessage = null;
    }

    private parseMessage(): boolean {
        if (this.chunksLen < HEADER_SIZE) {
            return false;
        }

        if (this.state === 'waiting_header') {
            let headerChunks = findAtLeastNBytes(this.chunks, 8);
            if (!headerChunks) {
                throw new VostokParsingError();
            }

            let header = Buffer.concat(headerChunks);

            let magic = header.readInt32BE(0);
            this.payloadSize = header.readInt32BE(4);

            if (magic !== MESSAGE_MAGIC) {
                throw new VostokParsingError();
            }

            this.state = 'waiting_payload';
        }
        if (this.state === 'waiting_payload') {
            if (this.chunksLen < this.payloadSize + HEADER_SIZE) {
                return false;
            }

            let messageChunks = findAtLeastNBytes(this.chunks, this.payloadSize + HEADER_SIZE);
            if (!messageChunks) {
                throw new VostokParsingError();
            }

            let message = Buffer.concat(messageChunks);
            let msg = message.slice(0, this.payloadSize + HEADER_SIZE);

            if (this.onMessage) {
                this.onMessage(msg.slice(HEADER_SIZE));
            }

            if (message.length > (this.payloadSize + HEADER_SIZE)) {
                let firstChunk = message.slice(this.payloadSize + HEADER_SIZE);
                this.chunks = [firstChunk, ...this.chunks.splice(messageChunks.length)];
            } else {
                this.chunks = this.chunks.splice(messageChunks.length);
            }

            this.chunksLen = chunksLength(this.chunks);
            this.state = 'waiting_header';
            this.payloadSize = 0;

            if (this.chunksLen >= HEADER_SIZE) {
                return this.parseMessage();
            }
            return true;
        }

        return false;
    }
}