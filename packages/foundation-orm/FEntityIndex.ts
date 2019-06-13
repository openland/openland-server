import { FSubspace } from 'foundation-orm/FSubspace';
import { FConnection } from 'foundation-orm/FConnection';
import { FTuple } from './encoding/FTuple';
import { FEncoders } from './encoding/FEncoders';

export class FEntityIndex {
    readonly name: string;
    readonly fields: string[];
    readonly unique: boolean;
    readonly condition?: (src: any) => boolean;
    readonly directoryRaw: FSubspace;
    readonly directory: FSubspace<FTuple[], any>;

    constructor(connection: FConnection, entityName: string, name: string, fields: string[], unique: boolean, condition?: (src: any) => boolean) {
        this.name = name;
        this.fields = fields;
        this.unique = unique;
        this.condition = condition;
        this.directoryRaw = connection.directories.getDirectory(['entity', entityName, '__indexes', name]);
        this.directory = this.directoryRaw
            .withKeyEncoding(FEncoders.tuple)
            .withValueEncoding(FEncoders.json);
    }
}