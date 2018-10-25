import { FNamespace } from './FNamespace';
import { FConnection } from './FConnection';
import { FEntity, FEntityOptions } from './FEntity';
import { FWatch } from './FWatch';
import { FEntityIndex } from './FEntityIndex';
import { FStreamItem } from './FStreamItem';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FStream } from './FStream';

export abstract class FEntityFactory<T extends FEntity> {
    readonly namespace: FNamespace;
    readonly connection: FConnection;
    readonly options: FEntityOptions;
    readonly indexes: FEntityIndex[];
    private watcher: FWatch;

    constructor(connection: FConnection, namespace: FNamespace, options: FEntityOptions, indexes: FEntityIndex[]) {
        this.namespace = namespace;
        this.connection = connection;
        this.options = options;
        this.indexes = indexes;
        this.watcher = new FWatch(connection);
    }

    async findAll() {
        let res = await this.namespace.range(this.connection, []);
        return res.map((v) => this._createEntity(v, false));
    }

    protected abstract _createEntity(value: any, isNew: boolean): T;

    protected async _findById(key: (string | number)[]) {
        let res = await this.namespace.get(this.connection, key);
        if (res) {
            return this._createEntity(res, false);
        }
        return null;
    }

    protected async _findRange(key: (string | number)[], limit: number, reverse?: boolean) {
        let res = await this.namespace.range(this.connection, key, { limit, reverse });
        return res.map((v) => this._createEntity(v.item, false));
    }

    protected async _findRangeAfter(subspace: (string | number)[], after?: string, limit?: number) {
        if (after) {
            let res = await this.namespace.rangeAfter(this.connection, subspace, FKeyEncoding.decodeFromString(after) as any, { limit });
            return res.map((v) => ({ value: this._createEntity(v.item, false), cursor: FKeyEncoding.encodeKeyToString(v.key) } as FStreamItem<T>));
        } else {
            let res = await this.namespace.range(this.connection, subspace, { limit });
            return res.map((v) => ({ value: this._createEntity(v.item, false), cursor: FKeyEncoding.encodeKeyToString(v.key) } as FStreamItem<T>));
        }
    }

    protected _createStream(subspace: (string | number)[], limit: number, after?: string): FStream<T> {
        return new FStream(this.connection, subspace, limit, (s) => this._createEntity(s, false), after);
    }

    protected async _findAll(key: (string | number)[]) {
        let res = await this.namespace.range(this.connection, key);
        return res.map((v) => this._createEntity(v.item, false));
    }

    protected async _create(key: (string | number)[], value: any) {
        if (await this._findById(key)) {
            throw Error('Object already exists');
        }
        return this._createEntity(value, true);
    }

    protected _watch(key: (string | number)[], cb: () => void) {
        let fullKey = [...this.namespace.namespace, ...key];

        return this.watcher.watch(fullKey, cb);
    }
}