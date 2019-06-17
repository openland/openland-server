import { FSubspace } from 'foundation-orm/FSubspace';
import { FTuple } from './encoding/FTuple';
import { FEncoders } from './encoding/FEncoders';
import { EntityLayer } from './EntityLayer';

export class FEntityIndex {
    readonly name: string;
    readonly fields: string[];
    readonly unique: boolean;
    readonly condition?: (src: any) => boolean;
    readonly directoryRaw: FSubspace;
    readonly directory: FSubspace<FTuple[], any>;

    constructor(layer: EntityLayer, entityName: string, name: string, fields: string[], unique: boolean, condition?: (src: any) => boolean) {
        this.name = name;
        this.fields = fields;
        this.unique = unique;
        this.condition = condition;
        this.directoryRaw = layer.directory.getDirectory(['entity', entityName, '__indexes', name]);
        this.directory = this.directoryRaw
            .withKeyEncoding(FEncoders.tuple)
            .withValueEncoding(FEncoders.json);
    }
}