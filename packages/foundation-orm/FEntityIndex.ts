import { Tuple } from '@openland/foundationdb/lib/encoding';
import { Subspace, encoders } from '@openland/foundationdb';

export class FEntityIndex {
    readonly name: string;
    readonly fields: string[];
    readonly unique: boolean;
    readonly condition?: (src: any) => boolean;
    readonly directory: Subspace<Tuple[], any>;

    constructor(
        directory: Subspace,
        name: string,
        fields: string[],
        unique: boolean,
        condition?: (src: any) => boolean,
    ) {
        this.name = name;
        this.fields = fields;
        this.unique = unique;
        this.condition = condition;
        this.directory = directory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json);
    }
}