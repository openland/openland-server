import { FEntity } from './FEntity';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FEntityFactory } from './FEntityFactory';
import { createEmptyContext } from 'openland-utils/Context';
import { resolveContext } from './utils/contexts';

export class FStream<T extends FEntity> {
    readonly factory: FEntityFactory<T>;
    private readonly limit: number;
    private readonly builder: (val: any) => T;
    private _subspace: any[];
    private _cursor: string;
    private ctx = createEmptyContext();

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
        let res = await resolveContext(this.ctx).range(this.ctx, this.factory.connection, FKeyEncoding.encodeKey(this._subspace), { limit: 1, reverse: true });
        if (res.length === 1) {
            return FKeyEncoding.encodeKeyToString(FKeyEncoding.decodeKey(res[0].key) as any);
        } else {
            return undefined;
        }
    }

    async next(): Promise<T[]> {
        console.log('from');
        console.log(FKeyEncoding.decodeFromString(this._cursor));
        if (this._cursor && this._cursor !== '') {
            let res = await resolveContext(this.ctx).rangeAfter(this.ctx, this.factory.connection, this._subspace, FKeyEncoding.decodeFromString(this._cursor) as any, { limit: this.limit });
            let d: T[] = [];
            for (let r of res) {
                d.push(this.builder(r.item));
                this._cursor = FKeyEncoding.encodeKeyToString(FKeyEncoding.decodeKey(r.key) as any);
                console.log('next');
                console.log(FKeyEncoding.decodeKey(r.key));
            }
            console.log('end');
            return d;
        } else {
            let res = await resolveContext(this.ctx).range(this.ctx, this.factory.connection, FKeyEncoding.encodeKey(this._subspace), { limit: this.limit });
            let d: T[] = [];
            for (let r of res) {
                d.push(this.builder(r.item));
                this._cursor = FKeyEncoding.encodeKeyToString(FKeyEncoding.decodeKey(r.key) as any);
                console.log('next');
                console.log(FKeyEncoding.decodeKey(r.key));
            }
            console.log('end');
            return d;
        }
    }
}