import { FAtomicBoolean } from './FAtomicBoolean';
import { EntityLayer } from './EntityLayer';
import { Tuple, Subspace, encoders } from '@openland/foundationdb';

export class FAtomicBooleanFactory {

    readonly layer: EntityLayer;
    readonly directory: Subspace;

    protected constructor(layer: EntityLayer, subspace: Subspace) {
        this.layer = layer;
        this.directory = subspace;
    }

    protected _findById(key: Tuple[]) {
        return new FAtomicBoolean(encoders.tuple.pack(key), this.directory);
    }
}