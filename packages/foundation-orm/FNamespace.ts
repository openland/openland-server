import { FConnection } from './FConnection';

export class FNamespace {
    readonly namespace: (string | number)[];

    constructor(...namespace: (string | number)[]) {
        this.namespace = namespace;
    }

    get = async (connection: FConnection, ...key: (string | number)[]) => {
        return connection.currentContext.get(connection, ...this.namespace, ...key);
    }

    range = async (connection: FConnection, limit: number, ...key: (string | number)[]) => {
        if (limit < 0) {
            throw Error('Limit should be greater than zero');
        }
        if (limit > 1000) {
            throw Error('Limit should be less than 100');
        }
        return connection.currentContext.range(connection, limit, ...this.namespace, ...key);
    }

    set = async (connection: FConnection, value: any, ...key: (string | number)[]) => {
        return connection.currentContext.set(connection, value, ...this.namespace, ...key);
    }

    delete = async (connection: FConnection, ...key: (string | number)[]) => {
        return connection.currentContext.delete(connection, ...this.namespace, ...key);
    }
}