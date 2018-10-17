import { FConnection } from './FConnection';

export class FNamespace {
    readonly namespace: (string | number)[];

    constructor(...namespace: (string | number)[]) {
        this.namespace = namespace;
    }

    get = async (connection: FConnection, ...key: (string | number)[]) => {
        return (await connection.fdb.get([this.namespace, ...key]));
    }

    set = async (connection: FConnection, value: any, ...key: (string | number)[]) => {
        return await connection.fdb.set([this.namespace, ...key], value);
    }
}