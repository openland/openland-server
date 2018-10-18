import { FNamespace } from './FNamespace';
import { FConnection } from './FConnection';
import { FEntity } from './FEntity';
import { FContext } from './FContext';

export abstract class FEntityFactory<T extends FEntity, S> {
    readonly namespace: FNamespace;
    readonly connection: FConnection;

    constructor(connection: FConnection, namespace: FNamespace) {
        this.namespace = namespace;
        this.connection = connection;
    }

    protected abstract _createEntity(context: FContext, namespace: FNamespace, id: (string | number)[], value: any): T;

    protected async _findById(key: (string | number)[]) {
        let res = await this.namespace.get(this.connection, ...key);
        if (res) {
            return this._createEntity(this.connection.currentContext, this.namespace, key, res);
        }
        return null;
    }

    protected _create(key: (string | number)[], value: any) {
        let res = this._createEntity(this.connection.currentContext, this.namespace, key, value);
        res.markDirty();
        return res;
    }
}