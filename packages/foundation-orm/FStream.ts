import { FEntity } from './FEntity';
import { FConnection } from './FConnection';
import { FKeyEncoding } from './utils/FKeyEncoding';

export class FStream<T extends FEntity> {
    private readonly connection: FConnection;
    private readonly limit: number;
    private readonly builder: (val: any) => T;
    private _subspace: any[];
    private _cursor: string;

    constructor(connection: FConnection, subspace: any[], limit: number, builder: (val: any) => T, after?: string) {
        this._subspace = subspace;
        this._cursor = after || '';
        this.limit = limit;
        this.connection = connection;
        this.builder = builder;
    }

    get cursor() {
        return this._cursor;
    }

    seek(offset: string) {
        this._cursor = offset;
    }

    reset() {
        this._cursor = '';
    }

    async next(): Promise<T[]> {
        if (this._cursor && this._cursor !== '') {
            let res = await this.connection.currentContext.rangeAfter(this.connection, this._subspace, FKeyEncoding.decodeFromString(this._cursor) as any, { limit: this.limit });
            let d: T[] = [];
            for (let r of res) {
                d.push(this.builder(r.item));
                this._cursor = FKeyEncoding.encodeKeyToString(r.key);
            }
            return d;
        } else {
            let res = await this.connection.currentContext.range(this.connection, this._subspace, { limit: this.limit });
            let d: T[] = [];
            for (let r of res) {
                d.push(this.builder(r.item));
                this._cursor = FKeyEncoding.encodeKeyToString(r.key);
            }
            return d;
        }
    }
}