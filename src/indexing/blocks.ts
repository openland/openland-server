import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';
import { buildGeoJson } from '../modules/geometry';

export function createBlocksIndexer(client: ES.Client) {

    let reader = new UpdateReader('reader_blocks', 1, DB.Block);

    reader.elastic(client, 'blocks', 'block', {
        geometry: {
            type: 'geo_shape',
            tree: 'quadtree',
            precision: '50m'
        }
    });

    reader.indexer((item) => {
        let geometry = undefined;
        if (item.geometry && item.blockId !== '4349' && item.blockId !== '4991') {
            geometry = buildGeoJson(item.geometry);
            // if (item.id === 24917 || item.id === 24916) {
            //     console.warn(JSON.stringify(geometry));
            // }
            // console.warn(JSON.stringify(geometry));
        }
        return {
            id: item.id!!,
            doc: {
                blockId: item.blockId,
                geometry: geometry
            }
        };
    });

    return reader;
    // reader.start();
}