import { FDirectory } from './FDirectory';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FAtomicInteger } from './FAtomicInteger';
import { EntityLayer } from './EntityLayer';
import { Subspace } from '@openland/foundationdb';
import { Tuple } from '@openland/foundationdb/lib/encoding';

export class FAtomicIntegerFactory {

    readonly layer: EntityLayer;
    readonly directory: FDirectory;
    readonly keySpace: Subspace;

    constructor(name: string, layer: EntityLayer) {
        this.layer = layer;
        this.keySpace = layer.db.allKeys;
        this.directory = layer.directory.getDirectory(['atomic', name]);
    }

    protected _findById(key: Tuple[]) {
        return new FAtomicInteger(FKeyEncoding.encodeKey(key), this.directory);
    }
}