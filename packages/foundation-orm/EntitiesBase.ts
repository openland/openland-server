import { EntityLayer } from './EntityLayer';

export class EntitiesBase {
    
    readonly layer: EntityLayer;
    constructor(layer: EntityLayer) {
        this.layer = layer;
    }
}