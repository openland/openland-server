import { EntityLayer } from './EntityLayer';

export class FDBInstance {
    readonly layer: EntityLayer;
    constructor(layer: EntityLayer) {
        this.layer = layer;
    }
}