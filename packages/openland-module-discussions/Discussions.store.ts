// @ts-nocheck
import {
    declareSchema,
    atomicInt,
    primaryKey,
    atomicBool,
    integer,
    entity,
    field,
    string,
    optional,
    boolean,
    rangeIndex,
    uniqueIndex,
    enumString,
    json,
    struct,
    customDirectory,
    array,
    union,
    event,
    float, allowDelete,
} from '@openland/foundationdb-compiler';

export function discussionsStore() {
    entity('DiscussionHub', () => {
        primaryKey('id', integer());
        field('description', union({
            'personal': struct({ uid: integer() }),
            'public': struct({ title: string() }),
            'system': struct({ title: string() }),
            'secret': struct({ title: string(), uid: integer() })
        }));
    });
    entity('Discussion', () => {
        primaryKey('id', string());
        field('uid', integer());
        field('hubId', integer());
        field('title', string());
        field('state', enumString('draft', 'published', 'archived'));
        field('publishedAt', optional(integer()));
        field('editedAt', optional(integer()));
        field('archivedAt', optional(integer()));

        rangeIndex('draft', ['uid', 'createdAt']).withCondition((src) => src.state === 'draft');
        rangeIndex('published', ['hubId', 'publishedAt']).withCondition((src) => src.state === 'published');
    });
}