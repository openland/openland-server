import { Tuple } from '@openland/foundationdb/lib/encoding';
import { Subspace, encoders } from '@openland/foundationdb';
import { EntityLayer } from './EntityLayer';

export class FEntityIndex {
    readonly name: string;
    readonly fields: string[];
    readonly unique: boolean;
    readonly condition?: (src: any) => boolean;
    readonly directoryRaw: Subspace;
    readonly directory: Subspace<Tuple[], any>;

    constructor(layer: EntityLayer, entityName: string, name: string, fields: string[], unique: boolean, condition?: (src: any) => boolean) {
        this.name = name;
        this.fields = fields;
        this.unique = unique;
        this.condition = condition;
        this.directoryRaw = layer.directory.getDirectory(['entity', entityName, '__indexes', name]);
        this.directory = this.directoryRaw
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json);
    }
}