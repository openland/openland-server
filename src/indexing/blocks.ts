import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function startBlocksIndexer(client: ES.Client) {

    let reader = new UpdateReader('blocks_indexing_1', DB.Block);

    reader.elastic(client, 'blocks', 'block', {
        geometry: {
            type: 'geo_shape',
            tree: 'quadtree',
            precision: '1m'
        }
    });

    reader.indexer((item) => {
        let geometry = undefined;
        if (item.geometry !== null) {
            geometry = {
                type: 'multipolygon',
                coordinates: item.geometry!!.polygons
                    .filter((v) => v.coordinates.length >= 4)
                    .map((v) => [v.coordinates.map((c) => [c.longitude, c.latitude])])
            };
        }
        return {
            id: item.id!!,
            doc: {
                blockId: item.blockId,
                geometry: geometry
            }
        };
    });

    reader.start();
}