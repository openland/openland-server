import { FNamespace } from './FNamespace';
import { FConnection } from './FConnection';
import { FEntity, FEntityOptions } from './FEntity';
import { FWatch } from './FWatch';
import { FEntityIndex } from './FEntityIndex';

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
        let res = await this.namespace.rangeAll(this.connection);
        return res.map((v) => this._createEntity(v, false));
    }

    protected abstract _createEntity(value: any, isNew: boolean): T;

    protected async _findById(key: (string | number)[]) {
        let res = await this.namespace.get(this.connection, ...key);
        if (res) {
            return this._createEntity(res, false);
        }
        return null;
    }

    protected async _findRange(key: (string | number)[], limit: number) {
        let res = await this.namespace.range(this.connection, limit, ...key);
        return res.map((v) => this._createEntity(v, false));
    }

    protected async _findAll(key: (string | number)[]) {
        let res = await this.namespace.rangeAll(this.connection, ...key);
        return res.map((v) => this._createEntity(v, false));
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