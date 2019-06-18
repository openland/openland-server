import { FDirectory } from './FDirectory';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FSubspace } from './FSubspace';
import { FTuple } from './encoding/FTuple';
import { FAtomicBoolean } from './FAtomicBoolean';
import { EntityLayer } from './EntityLayer';

export class FAtomicBooleanFactory {

    readonly layer: EntityLayer;
    readonly directory: FDirectory;
    readonly keySpace: FSubspace;

    constructor(name: string, layer: EntityLayer) {
        this.layer = layer;
        this.keySpace = layer.db.allKeys;
        this.directory = layer.directory.getDirectory(['atomic', name]);
    }

    protected _findById(key: FTuple[]) {
        return new FAtomicBoolean(FKeyEncoding.encodeKey(key), this.directory);
    }
}