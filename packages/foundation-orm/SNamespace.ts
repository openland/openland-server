import { SConnection } from './SConnection';

export class SNamespace {
    readonly namespace: (string | number)[];

    constructor(...namespace: (string | number)[]) {
        this.namespace = namespace;
    }

    get = async (connection: SConnection, ...key: (string | number)[]) => {
        return (await connection.fdb.get([this.namespace, ...key]));
    }

    set = async (connection: SConnection, value: any, ...key: (string | number)[]) => {
        return await connection.fdb.set([this.namespace, ...key], value);
    }
}