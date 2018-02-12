import * as ES from 'elasticsearch';
// import { DB } from '../tables';
// import { UpdateReader } from '../modules/updateReader';
// import { uploadFeature, mapBoxConfigured } from '../modules/mapbox';

export function startBlocksIndexer(client: ES.Client) {

    // let reader = new UpdateReader('blocks_indexing_1', DB.Block);

    // reader.elastic(client, 'blocks', 'block', {
    //     geometry: {
    //         type: 'geo_shape',
    //         tree: 'quadtree',
    //         precision: '1m'
    //     }
    // });

    // reader.indexer((item) => {
    //     let geometry = undefined;
    //     if (item.geometry !== null) {
    //         geometry = {
    //             type: 'multipolygon',
    //             coordinates: item.geometry!!.polygons
    //                 .filter((v) => v.coordinates.length >= 4)
    //                 .map((v) => [v.coordinates.map((c) => [c.longitude, c.latitude])])
    //         };
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

    // if (mapBoxConfigured()) {
    //     reader = new UpdateReader('blocks_indexing_mapbox', DB.Block);
    //     reader.processor(async (data) => {
    //         for (let item of data) {
    //             if (item.geometry === null) {
    //                 continue;
    //             }
    //             let geometry = item.geometry!!.polygons
    //                 .filter((v) => v.coordinates.length >= 4)
    //                 .map((v) => ({
    //                     type: 'Polygon',
    //                     coordinates: [v.coordinates.map((c) => [c.longitude, c.latitude])]
    //                 }))[0];
    //             await uploadFeature('cjcs7tqe036sd2zo7l5remeef', item.blockId!!, geometry);
    //         }
    //     });
    //     reader.start();
    // }
}