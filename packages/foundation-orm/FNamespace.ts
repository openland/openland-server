import { FConnection } from './FConnection';
import { RangeOptions } from 'foundationdb/dist/lib/transaction';

export class FNamespace {
    readonly namespace: (string | number)[];

    constructor(...namespace: (string | number)[]) {
        this.namespace = namespace;
    }

    get = async (connection: FConnection, key: (string | number)[]) => {
        return connection.currentContext.get(connection, [...this.namespace, ...key]);
    }

    range = async (connection: FConnection, key: (string | number)[], options?: RangeOptions) => {
        return connection.currentContext.range(connection, [...this.namespace, ...key], options);
    }

    rangeAfter = async (connection: FConnection, key: (string | number)[], after: (string | number)[], options?: RangeOptions) => {
        return connection.currentContext.rangeAfter(connection, [...this.namespace, ...key], [...after], options);
    }

    set = (connection: FConnection, key: (string | number)[], value: any) => {
        connection.currentContext.set(connection, [...this.namespace, ...key], value);
    }

    delete = (connection: FConnection, key: (string | number)[]) => {
        connection.currentContext.delete(connection, [...this.namespace, ...key]);
    }
}