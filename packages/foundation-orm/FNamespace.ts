import { FConnection } from './FConnection';
import { FSubspace } from './FSubspace';
import { FTuple } from './encoding/FTuple';
import { FEncoders } from './encoding/FEncoders';

export class FNamespace {
    readonly namespace: (string | number)[];
    readonly keySpace: FSubspace<FTuple[], any>;

    constructor(connection: FConnection, ...namespace: (string | number)[]) {
        this.namespace = namespace;
        this.keySpace = connection.keySpace
            .withKeyEncoding(FEncoders.tuple)
            .withValueEncoding(FEncoders.json)
            .subspace(namespace);
    }
}