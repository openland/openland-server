import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';
// import fetch, { Headers, Request } from 'node-fetch';
// let token = 'sk.eyJ1Ijoic3RldmUta2l0ZSIsImEiOiJjamNzODJxMWUzOWp2MzNvMHJwbTJ0MThyIn0.iauuBqfi1XIGZ30UH-xGGA';

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

    // reader = new UpdateReader('blocks_indexing_mapbox', DB.Block);
    // reader.processor(async (data) => {
    //     for (let item of data) {
    //         if (item.geometry === null) {
    //             continue;
    //         }

    //         let geometry = item.geometry!!.polygons
    //             .filter((v) => v.coordinates.length >= 4)
    //             .map((v) => ({
    //                 type: 'Polygon',
    //                 coordinates: [v.coordinates.map((c) => [c.longitude, c.latitude])]
    //             }))[0];

    //         let url = `https://api.mapbox.com/datasets/v1/steve-kite/cjcs7tqe036sd2zo7l5remeef/features/${item.blockId}?access_token=${token}`;
    //         try {
    //             let body = JSON.stringify({
    //                 type: 'Feature',
    //                 geometry: geometry,
    //                 properties: {
    //                     title: item.blockId
    //                 }
    //             });
    //             let res = await fetch(url, {
    //                 method: 'put',
    //                 headers: {
    //                     'Content-Type': 'application/json'
    //                 },
    //                 body: body
    //             });
    //             console.warn(body);
    //             if (res.status !== 200) {
    //                 throw Error('Wrong status');
    //             }
    //         } catch (e) {
    //             console.warn(e);
    //             throw e;
    //         }
    //     }
    // });
    // reader.start();
}