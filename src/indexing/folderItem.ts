import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';
import { ParcelsProperties, ParcelsInclude, indexParcel } from './shared/parcels';

export function createFolderItemsIndexer(client: ES.Client) {
    let reader = new UpdateReader('reader_folder_items', 1, DB.FolderItem);
    reader.elastic(client, 'folder_items', 'item', {
        ...ParcelsProperties
    });
    reader.include([{ model: DB.Lot, as: 'lot', include: ParcelsInclude }]);
    reader.indexer((item) => {
        return {
            id: item.id!!,
            doc: {
                ...indexParcel(item.lot!!)
            }
        };
    });
    reader.enalbeAutoOutOfOrder();
    return reader;
}