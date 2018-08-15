import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function createChannelIndexer(client: ES.Client) {
    let reader = new UpdateReader('reader_channels', 2, DB.Conversation);
    reader.elastic(client, 'channels', 'channel', {
        title: {
            type: 'text'
        },
        featured: {
            type: 'boolean'
        }
    });
    reader.indexer(async (item) => {
        if (item.type !== 'channel') {
            return null;
        }

        return {
            id: item.id!!,
            doc: {
                title: item.title,
                featured: item.extras.featured || false
            }
        };
    });
    reader.enalbeAutoOutOfOrder();
    return reader;
}