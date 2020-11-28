import { declareSearchIndexer } from '../../openland-module-search/declareSearchIndexer';
import { Store } from '../../openland-module-db/FDB';

export function badgeIndexer() {
    declareSearchIndexer({
        name: 'modern-badge-index',
        index: 'badges',
        version: 1,
        stream: Store.ModernBadge.updated.stream({ batchSize: 100 }),
    }).withProperties({
        emoji: {
            type: 'keyword',
        },
        text: {
            type: 'text',
        },
        global: {
          type: 'boolean',
        },
        banned: {
            type: 'boolean',
        },
    }).start(async (item) => {
        return {
            doc: {
                emoji: item.emoji,
                text: item.text,
                global: item.global,
                banned: item.banned,
            }, id: item.id,
        };
    });
}