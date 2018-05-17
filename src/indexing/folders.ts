import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function createFoldersIndexer(client: ES.Client) {
    let reader = new UpdateReader('reader_folders', 1, DB.Folder);
    reader.elastic(client, 'folders', 'folder', {
        orgId: {
            type: 'integer'
        },
        name: {
            type: 'text'
        },
    });
    reader.indexer((item) => {
        return {
            id: item.id!!,
            doc: {
                orgId: item.organizationId,
                name: item.name
            }
        };
    });
    return reader;
}