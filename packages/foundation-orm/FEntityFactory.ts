import { FNamespace } from './FNamespace';
import { FConnection } from './FConnection';
import { FEntity, FEntityOptions } from './FEntity';

export abstract class FEntityFactory<T extends FEntity, S> {
    readonly namespace: FNamespace;
    readonly connection: FConnection;
    readonly options: FEntityOptions;

    constructor(connection: FConnection, namespace: FNamespace, options: FEntityOptions) {
        this.namespace = namespace;
        this.connection = connection;
        this.options = options;
    }

    protected abstract _createEntity(id: (string | number)[], value: any, isNew: boolean): T;

    protected async _findById(key: (string | number)[]) {
        let res = await this.namespace.get(this.connection, ...key);
        if (res) {
            return this._createEntity(key, res, false);
        }
        return null;
    }

    protected async _create(key: (string | number)[], value: any) {
        if (await this._findById(key)) {
            throw Error('Trying to create existing object');
        }
        return this._createEntity(key, value, true);
    }
}