import { FConnection } from './FConnection';
import { FOperations } from './FOperations';
import { FTuple } from './FTuple';
import { FEncoders } from './FEncoders';

export class FNamespace {
    readonly namespace: (string | number)[];
    readonly ops: FOperations<FTuple[], any>;

    constructor(connection: FConnection, ...namespace: (string | number)[]) {
        this.namespace = namespace;
        this.ops = connection.ops
            .withKeyEncoding(FEncoders.tuple)
            .withValueEncoding(FEncoders.json)
            .subspace(namespace);
    }
}