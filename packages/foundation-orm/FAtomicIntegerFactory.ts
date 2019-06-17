import { FDirectory } from './FDirectory';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FAtomicInteger } from './FAtomicInteger';
import { FSubspace } from './FSubspace';
import { FTuple } from './encoding/FTuple';
import { EntityLayer } from './EntityLayer';

export class FAtomicIntegerFactory {

    readonly layer: EntityLayer;
    readonly directory: FDirectory;
    readonly keySpace: FSubspace;

    constructor(name: string, layer: EntityLayer) {
        this.layer = layer;
        this.keySpace = layer.db.keySpace;
        this.directory = layer.directory.getDirectory(['atomic', name]);
    }

    protected _findById(key: FTuple[]) {
        return new FAtomicInteger(FKeyEncoding.encodeKey(key), this.directory);
    }
}