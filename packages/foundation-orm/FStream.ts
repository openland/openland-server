import { FEntity } from './FEntity';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FEntityFactory } from './FEntityFactory';

export class FStream<T extends FEntity> {
    readonly factory: FEntityFactory<T>;
    private readonly limit: number;
    private readonly builder: (val: any) => T;
    private _subspace: any[];
    private _cursor: string;

    constructor(factory: FEntityFactory<T>, subspace: any[], limit: number, builder: (val: any) => T, after?: string) {
        this._subspace = subspace;
        this._cursor = after || '';
        this.limit = limit;
        this.factory = factory;
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

    async tail() {
        let res = await this.factory.connection.currentContext.range(this.factory.connection, this._subspace, { limit: 1, reverse: true });
        if (res.length === 1) {
            return FKeyEncoding.encodeKeyToString(res[0].key);
        } else {
            return undefined;
        }
    }

    async next(): Promise<T[]> {
        if (this._cursor && this._cursor !== '') {
            let res = await this.factory.connection.currentContext.rangeAfter(this.factory.connection, this._subspace, FKeyEncoding.decodeFromString(this._cursor) as any, { limit: this.limit });
            let d: T[] = [];
            for (let r of res) {
                d.push(this.builder(r.item));
                this._cursor = FKeyEncoding.encodeKeyToString(r.key);
            }
            return d;
        } else {
            let res = await this.factory.connection.currentContext.range(this.factory.connection, this._subspace, { limit: this.limit });
            let d: T[] = [];
            for (let r of res) {
                d.push(this.builder(r.item));
                this._cursor = FKeyEncoding.encodeKeyToString(r.key);
            }
            return d;
        }
    }
}