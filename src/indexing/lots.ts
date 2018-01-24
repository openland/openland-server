import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';
import { mapBoxConfigured, uploadFeature } from '../modules/mapbox';

export function startLotsIndexer(client: ES.Client) {

    let reader = new UpdateReader('lots_indexing_9', DB.Lot);

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
                coordinates: item.geometry!!.polygons
                    .filter((v) => v.coordinates.length >= 4)
                    .map((v) => [v.coordinates.map((c) => [c.longitude, c.latitude])])
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

    if (mapBoxConfigured()) {
        reader = new UpdateReader('lots_indexing_mapbox_2', DB.Lot);
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
        reader.processor(async (data) => {
            for (let item of data) {
                if (item.geometry === null) {
                    continue;
                }

                let id = item.block!!.blockId + '_' + item.lotId;

                let geometry = item.geometry!!.polygons
                    .filter((v) => v.coordinates.length >= 4)
                    .map((v) => ({
                        type: 'Polygon',
                        coordinates: [v.coordinates.map((c) => [c.longitude, c.latitude])]
                    }))[0];

                await uploadFeature('cjctj2irl0k5z2wvtz46ld417', id, geometry);
            }
        });
        reader.start();
    }
}