import { FAtomicInteger } from './FAtomicInteger';
import { EntityLayer } from './EntityLayer';
import { Tuple, Subspace, encoders } from '@openland/foundationdb';

export class FAtomicIntegerFactory {

    readonly layer: EntityLayer;
    readonly directory: Subspace;

    protected constructor(layer: EntityLayer, subspace: Subspace) {
        this.layer = layer;
        this.directory = subspace;
    }

    protected _findById(key: Tuple[]) {
        return new FAtomicInteger(encoders.tuple.pack(key), this.directory);
    }
}