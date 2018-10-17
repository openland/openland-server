import { SNamespace } from './SNamespace';
import { SConnection } from './SConnection';
import { SEntity } from './SEntity';
import { SContext } from './SContext';

export abstract class SEntityFactory<T extends SEntity> {
    readonly namespace: SNamespace;
    readonly connection: SConnection;

    constructor(connection: SConnection, namespace: SNamespace) {
        this.namespace = namespace;
        this.connection = connection;
    }

    protected abstract _createEntity(context: SContext, namespace: SNamespace, id: (string | number)[], value: any): T;

    protected async _findById(key: (string | number)[]) {
        let res = await this.namespace.get(this.connection, ...key);
        if (res) {
            return this._createEntity(this.connection.currentContext, this.namespace, key, res);
        }
        return null;
    }
}