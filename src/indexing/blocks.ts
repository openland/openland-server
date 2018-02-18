import * as ES from 'elasticsearch';
// import { DB } from '../tables';
// import { UpdateReader } from '../modules/updateReader';
// import { buildGeoJson } from '../modules/geometry';

export function startBlocksIndexer(client: ES.Client) {

    // let reader = new UpdateReader('blocks_indexing_2', DB.Block);

    // reader.elastic(client, 'blocks', 'block', {
    //     geometry: {
    //         type: 'geo_shape',
    //         tree: 'quadtree',
    //         precision: '1m'
    //     }
    // });

    // reader.indexer((item) => {
    //     let geometry = undefined;
    //     if (item.geometry) {
    //         geometry = buildGeoJson(item.geometry);
    //     }
    //     return {
    //         id: item.id!!,
    //         doc: {
    //             blockId: item.blockId,
    //             geometry: geometry
    //         }
    //     };
    // });

    // reader.start();
}