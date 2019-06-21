import { FKeyEncoding } from './utils/FKeyEncoding';
import { FAtomicBoolean } from './FAtomicBoolean';
import { EntityLayer } from './EntityLayer';
import { Tuple, Subspace } from '@openland/foundationdb';

export class FAtomicBooleanFactory {

    readonly layer: EntityLayer;
    readonly directory: Subspace;

    protected constructor(layer: EntityLayer, subspace: Subspace) {
        this.layer = layer;
        this.directory = subspace;
    }

    protected _findById(key: Tuple[]) {
        return new FAtomicBoolean(FKeyEncoding.encodeKey(key), this.directory);
    }
}