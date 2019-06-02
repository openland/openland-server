import { FEntity } from './FEntity';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FEntityFactory } from './FEntityFactory';
import { FSubspace } from './FSubspace';
import { FTuple } from './FTuple';
import { FEncoders } from './FEncoders';
import { fixObsoleteCursor } from './utils/fixObsoleteKey';
import { EmptyContext } from '@openland/context';

export class FStream<T extends FEntity> {
    readonly factory: FEntityFactory<T>;
    private readonly limit: number;
    private readonly builder: (val: any) => T;
    private _subspace: FTuple[];
    private keySpace: FSubspace<FTuple[], any>;
    private _cursor: string;
    private ctx = EmptyContext;

    constructor(factory: FEntityFactory<T>, subspace: FTuple[], limit: number, builder: (val: any) => T, after?: string) {
        this._subspace = subspace;
        this._cursor = after || '';
        this.keySpace = factory.connection.keySpace
            .withKeyEncoding(FEncoders.tuple)
            .withValueEncoding(FEncoders.json)
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

    async tail() {
        let res = await this.keySpace.range(this.ctx, [], { limit: 1, reverse: true });
        if (res.length === 1) {
            return FKeyEncoding.encodeKeyToString(res[0].key);
        } else {
            return undefined;
        }
    }

    async next(): Promise<T[]> {
        if (this._cursor && this._cursor !== '') {

            let fixedCursor = fixObsoleteCursor(FKeyEncoding.decodeFromString(this._cursor), this._subspace, []);
            let res = await this.keySpace.range(this.ctx, [], { limit: this.limit, after: fixedCursor });
            let d: T[] = [];
            for (let r of res) {
                d.push(this.builder(r.value));
                this._cursor = FKeyEncoding.encodeKeyToString(r.key);
            }
            return d;
        } else {
            let res = await this.keySpace.range(this.ctx, [], { limit: this.limit });
            let d: T[] = [];
            for (let r of res) {
                d.push(this.builder(r.value));
                this._cursor = FKeyEncoding.encodeKeyToString(r.key);
            }
            return d;
        }
    }
}