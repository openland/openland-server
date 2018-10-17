import { getFTransaction } from './FTransaction';
import { TupleItem } from 'foundationdb';

export class SFoundation<T> {
    private readonly namespace: string;

    constructor(namespace: string) {
        this.namespace = namespace;
    }

    get = async (...key: TupleItem[]) => {
        return (await getFTransaction().get([this.namespace, ...key])) as T;
    }

    set = async (value: T, ...key: TupleItem[]) => {
        return await getFTransaction().set([this.namespace, ...key], value);
    }
}