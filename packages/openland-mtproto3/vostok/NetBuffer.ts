class NetBufferBlock {
    readonly buffer: Buffer;
    readonly start = 0;
    readonly end: number;
    readonly rptr = 0;
    readonly wptr = 0;
    readonly next: NetBufferBlock|null;

    constructor(size: number, next: NetBufferBlock|null) {
        this.end = size;
        this.buffer = Buffer.alloc(size);
        this.next = next;
    }
}

class NetBuffer {
    readonly blockSize: number;
    readonly blocks: NetBufferBlock;

    constructor(blockSize: number) {
        this.blockSize = blockSize;
        this.blocks = new NetBufferBlock(blockSize, null);
    }

    blocksCount() {
        let count = 0;
        let block = this.blocks;
        while (block.next) {
            count++;
            block = block.next;
        }
        return count;
    }
}