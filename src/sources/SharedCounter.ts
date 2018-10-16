import * as fdb from 'foundationdb';
import { FDBConnection } from './init';

export class SharedCounter {

    readonly name: string;
    private readonly db: fdb.Database<fdb.TupleItem[], any>;

    constructor(name: string) {
        this.name = name;
        this.db = FDBConnection.at(['counters']);
    }

    get = async () => {
        let r = (await this.db.get([this.name]));
        if (r) {
            return r.value;
        } else {
            return 0;
        }
    }

    set = async (v: number) => {
        await this.db.set([this.name], { value: v });
    }
}