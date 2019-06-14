import Transaction from 'foundationdb/dist/lib/transaction';

const zero = Buffer.of();

export interface Directory {
    readonly path: string[];
    readonly key: Buffer;
    readonly layer: Buffer;
    
    createOrOpen(tn: Transaction<Buffer, Buffer>, path: string, layer: Buffer): Promise<Directory>;
    create(tn: Transaction<Buffer, Buffer>, path: string, layer: Buffer): Promise<Directory>;
    open(tn: Transaction<Buffer, Buffer>, path: string, layer: Buffer): Promise<Directory>;
}

export class DirectoryLayer implements Directory {
    path: string[] = [];
    key: Buffer = zero;
    layer: Buffer = zero;

    async createOrOpen(tn: Transaction<Buffer, Buffer>, path: string, layer: Buffer): Promise<Directory> {
        return this;
    }

    async create(tn: Transaction<Buffer, Buffer>, path: string, layer: Buffer): Promise<Directory> {
        return this;
    }

    async open(tn: Transaction<Buffer, Buffer>, path: string, layer: Buffer): Promise<Directory> {
        return this;
    }
}