import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function createWallPostsIndexer(client: ES.Client) {
    let reader = new UpdateReader('reader_wall_posts', 1, DB.WallPost);
    reader.elastic(client, 'wall_posts', 'wall_post', {
        tags: {
            type: 'keyword'
        }
    });
    reader.indexer(async (item) => {
        return {
            id: item.id!!,
            doc: {
                tags: item.extras!.tags || []
            }
        };
    });
    reader.enalbeAutoOutOfOrder();
    return reader;
}