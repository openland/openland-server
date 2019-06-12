import { FConnection } from './FConnection';
import { FSubspace } from './FSubspace';
import { FTuple } from './encoding/FTuple';
import { FEncoders } from './encoding/FEncoders';

export class FNamespace {
    readonly namespace: (string | number)[];
    readonly keySpace: FSubspace<FTuple[], any>;
    readonly keySpaceRaw: FSubspace<Buffer, Buffer>;

    constructor(connection: FConnection, ...namespace: (string | number)[]) {
        this.namespace = namespace;
        this.keySpaceRaw = connection.keySpace
            .subspace(FEncoders.tuple.pack(namespace));
        this.keySpace = connection.keySpace
            .withKeyEncoding(FEncoders.tuple)
            .withValueEncoding(FEncoders.json)
            .subspace(namespace);
    }
}