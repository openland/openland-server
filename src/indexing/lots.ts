import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function startLotsIndexer(client: ES.Client) {

    let reader = new UpdateReader('lots_indexing_8', DB.Lot);

    reader.elastic(client, 'parcels', 'parcel', {
        geometry: {
            type: 'geo_shape',
            tree: 'quadtree',
            precision: '1m'
        }
    });

    reader.include([{
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
    }]);

    reader.indexer((item) => {
        let geometry = undefined;
        if (item.geometry !== null) {
            geometry = {
                type: 'multipolygon',
                coordinates: item.geometry!!.polygons.map((v) => v.coordinates.map((c) => [c.longitude, c.latitude]))
            };
        }
        return {
            id: item.id!!,
            doc: {
                blockId: item.block!!.blockId!!,
                lotId: item.lotId!!,
                geometry: geometry
            }
        };
    });

    reader.start();
}