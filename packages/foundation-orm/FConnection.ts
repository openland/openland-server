import * as fdb from 'foundationdb';
import { FContext, FGlobalContext } from './FContext';

export class FConnection {
    readonly fdb: fdb.Database<fdb.TupleItem[], any>;
    private readonly globalContext: FContext;

    constructor(connection: fdb.Database<fdb.TupleItem[], any>) {
        this.fdb = connection;
        this.globalContext = new FGlobalContext(this);
    }

    get currentContext() {
        return this.globalContext;
    }
}