import { FConnection } from './FConnection';

export class FNamespace {
    readonly namespace: (string | number)[];

    constructor(...namespace: (string | number)[]) {
        this.namespace = namespace;
    }

    get = async (connection: FConnection, ...key: (string | number)[]) => {
        return connection.currentContext.get(connection, ...key);
    }

    set = async (connection: FConnection, value: any, ...key: (string | number)[]) => {
        return connection.currentContext.set(connection, [this.namespace, ...key], value);
    }
}