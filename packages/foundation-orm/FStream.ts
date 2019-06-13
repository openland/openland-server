import { FEntity } from './FEntity';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FEntityFactory } from './FEntityFactory';
import { FSubspace } from './FSubspace';
import { FTuple } from './encoding/FTuple';
// import { fixObsoleteCursor } from './utils/fixObsoleteKey';
import { inTx } from './inTx';
import { Context } from '@openland/context';

export class FStream<T extends FEntity> {
    readonly factory: FEntityFactory<T>;
    private readonly limit: number;
    private readonly builder: (val: any, ctx: Context) => T;
    // private _subspace: FTuple[];
    private keySpace: FSubspace<FTuple[], any>;
    private _cursor: string;

    constructor(factory: FEntityFactory<T>, keySpace: FSubspace<FTuple[], any>, subspace: FTuple[], limit: number, builder: (val: any, ctx: Context) => T, after?: string) {
        this._cursor = after || '';
        this.keySpace = keySpace
            .subspace(subspace);
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

    async tail(parent: Context) {
        let res = await inTx(parent, async (ctx) => await this.keySpace.range(ctx, [], { limit: 1, reverse: true }));
        if (res.length === 1) {
            return FKeyEncoding.encodeKeyToString(res[0].key);
        } else {
            return undefined;
        }
    }

    async next(parent: Context): Promise<T[]> {
        if (this._cursor && this._cursor !== '') {

            let fixedCursor = FKeyEncoding.decodeFromString(this._cursor); // fixObsoleteCursor(FKeyEncoding.decodeFromString(this._cursor), this._subspace, []);
            let res = await inTx(parent, async (ctx) => await this.keySpace.range(ctx, [], { limit: this.limit, after: fixedCursor }));
            let d: T[] = [];
            for (let r of res) {
                d.push(this.builder(r.value, parent));
                this._cursor = FKeyEncoding.encodeKeyToString(r.key);
            }
            return d;
        } else {
            let res = await inTx(parent, async (ctx) => await this.keySpace.range(ctx, [], { limit: this.limit }));
            let d: T[] = [];
            for (let r of res) {
                d.push(this.builder(r.value, parent));
                this._cursor = FKeyEncoding.encodeKeyToString(r.key);
            }
            return d;
        }
    }
}