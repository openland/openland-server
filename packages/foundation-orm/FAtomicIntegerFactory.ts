import { FKeyEncoding } from './utils/FKeyEncoding';
import { FAtomicInteger } from './FAtomicInteger';
import { EntityLayer } from './EntityLayer';
import { Tuple, Subspace } from '@openland/foundationdb';

export class FAtomicIntegerFactory {

    readonly layer: EntityLayer;
    readonly directory: Subspace;

    protected constructor(layer: EntityLayer, subspace: Subspace) {
        this.layer = layer;
        this.directory = subspace;
    }

    protected _findById(key: Tuple[]) {
        return new FAtomicInteger(FKeyEncoding.encodeKey(key), this.directory);
    }
}