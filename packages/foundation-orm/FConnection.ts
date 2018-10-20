import * as fdb from 'foundationdb';
import { FContext, FGlobalContext } from './FContext';
import { FTransaction } from './FTransaction';

export class FConnection {
    readonly fdb: fdb.Database<fdb.TupleItem[], any>;
    private readonly globalContext: FContext;

    constructor(connection: fdb.Database<fdb.TupleItem[], any>) {
        this.fdb = connection;
        this.globalContext = new FGlobalContext();
    }

    get currentContext(): FContext {
        let tx = FTransaction.context.value;
        if (tx) {
            return tx;
        }
        return this.globalContext;
    }
}