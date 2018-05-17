import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function createFoldersIndexer(client: ES.Client) {
    let reader = new UpdateReader('reader_folders', 4, DB.Folder);
    reader.elastic(client, 'folders', 'folder', {
        orgId: {
            type: 'integer'
        },
        name: {
            type: 'text'
        },
        retired: {
            type: 'boolean'
        }
    });
    reader.indexer((item) => {
        console.warn(item);
        return {
            id: item.id!!,
            doc: {
                orgId: item.organizationId,
                name: item.name,
                retired: item.deletedAt !== null
            }
        };
    });
    reader.enalbeAutoOutOfOrder();
    return reader;
}