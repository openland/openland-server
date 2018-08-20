import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';
import { Repos } from '../repositories';

export function createChannelIndexer(client: ES.Client) {
    let reader = new UpdateReader('reader_channels', 3, DB.Conversation);
    reader.elastic(client, 'channels', 'channel', {
        title: {
            type: 'text'
        },
        featured: {
            type: 'boolean'
        },
        createdAt: {
            type: 'date'
        },
        updatedAt: {
            type: 'date'
        },
        membersCount: {
            type: 'integer'
        },
    });
    reader.indexer(async (item) => {
        if (item.type !== 'channel') {
            return null;
        }

        return {
            id: item.id!!,
            doc: {
                title: item.title,
                featured: item.extras.featured || false,
                createdAt: (item as any).createdAt,
                updatedAt: (item as any).updatedAt,
                membersCount: Repos.Chats.membersCountInConversation(item.id),
            }
        };
    });
    reader.enalbeAutoOutOfOrder();
    return reader;
}