import { FConnection } from './FConnection';
import { RangeOptions } from 'foundationdb/dist/lib/transaction';
import { FKeyType } from './FKeyType';

export class FNamespace {
    readonly namespace: FKeyType;

    constructor(...namespace: FKeyType) {
        this.namespace = namespace;
    }

    get = async (connection: FConnection, key: FKeyType) => {
        return connection.currentContext.get(connection, [...this.namespace, ...key]);
    }

    range = async (connection: FConnection, key: FKeyType, options?: RangeOptions) => {
        return connection.currentContext.range(connection, [...this.namespace, ...key], options);
    }

    rangeAfter = async (connection: FConnection, key: FKeyType, after: FKeyType, options?: RangeOptions) => {
        return connection.currentContext.rangeAfter(connection, [...this.namespace, ...key], [...after], options);
    }

    set = async (connection: FConnection, key: FKeyType, value: any) => {
        return connection.currentContext.set(connection, [...this.namespace, ...key], value);
    }

    delete = async (connection: FConnection, key: FKeyType) => {
        return connection.currentContext.delete(connection, [...this.namespace, ...key]);
    }
}