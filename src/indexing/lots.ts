import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { updateReader } from '../modules/updateReader';

export function startLotsIndexer(client: ES.Client) {
    updateReader('lots_indexing_2', DB.Lot, [{
        model: DB.Block,
        as: 'block',
        include: [{
            model: DB.City,
            as: 'city',
            include: [{
                model: DB.County,
                as: 'county',
                include: [{
                    model: DB.State,
                    as: 'state'
                }]
            }]
        }]
    }], async (data) => {
        let forIndexing = [];
        for (let p of data) {
            forIndexing.push({
                index: {
                    _index: 'parcels',
                    _type: 'parcel',
                    _id: p.id
                }
            });
            let geometry = undefined;
            if (p.geometry !== null) {
                geometry = {
                    type: 'multipolygon',
                    coordinates: p.geometry!!.polygons.map((v) => v.coordinates.map((c) => [c.longitude, c.latitude]))
                };
            }
            forIndexing.push({
                blockId: p.block!!.blockId!!,
                lotId: p.lotId!!,
                geometry: geometry
            });
        }

        try {
            await client.indices.putMapping({
                index: 'parcels', type: 'parcel', body: {
                    properties: {
                        geometry: {
                            type: 'geo_shape',
                            tree: 'quadtree',
                            precision: '1m'
                        }
                    }
                }
            });
        } catch (e) {
            console.warn(e);
        }

        try {
            await client.bulk({
                body: forIndexing
            });
        } catch (e) {
            console.warn(e);
            throw e;
        }
    });
}