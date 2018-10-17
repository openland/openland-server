import * as fdb from 'foundationdb';
import { SContext, SGlobalContext } from './SContext';
export class SConnection {
    readonly fdb: fdb.Database<fdb.TupleItem[], any>;
    private readonly globalContext: SContext;

    constructor(connection: fdb.Database<fdb.TupleItem[], any>) {
        this.fdb = connection;
        this.globalContext = new SGlobalContext(this);
    }

    get currentContext() {
        return this.globalContext;
    }
}