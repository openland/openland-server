import { FDirectory } from './FDirectory';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FAtomicBoolean } from './FAtomicBoolean';
import { EntityLayer } from './EntityLayer';
import { Tuple } from '@openland/foundationdb/lib/encoding';

export class FAtomicBooleanFactory {

    readonly layer: EntityLayer;
    readonly directory: FDirectory;

    constructor(name: string, layer: EntityLayer) {
        this.layer = layer;
        this.directory = layer.directory.getDirectory(['atomic', name]);
    }

    protected _findById(key: Tuple[]) {
        return new FAtomicBoolean(FKeyEncoding.encodeKey(key), this.directory);
    }
}