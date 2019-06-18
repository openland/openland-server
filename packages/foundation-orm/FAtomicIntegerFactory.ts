import { FDirectory } from './FDirectory';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FAtomicInteger } from './FAtomicInteger';
import { EntityLayer } from './EntityLayer';
import { Tuple } from '@openland/foundationdb/lib/encoding';

export class FAtomicIntegerFactory {

    readonly layer: EntityLayer;
    readonly directory: FDirectory;

    constructor(name: string, layer: EntityLayer) {
        this.layer = layer;
        this.directory = layer.directory.getDirectory(['atomic', name]);
    }

    protected _findById(key: Tuple[]) {
        return new FAtomicInteger(FKeyEncoding.encodeKey(key), this.directory);
    }
}