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
import { Image, Spans } from '../openland-module-db/store.schema';

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
        primaryKey('id', integer());
        field('uid', integer());
        field('hubId', optional(integer()));
        field('state', enumString('draft', 'published', 'archived'));
        field('publishedAt', optional(integer()));
        field('editedAt', optional(integer()));
        field('archivedAt', optional(integer()));

        field('title', string());
        field('content', optional(array(union({
            text: struct({
                text: string(),
                spans: Spans
            }),
            image: struct({
                image: Image
            })
        }))));

        rangeIndex('draft', ['uid', 'updatedAt']).withCondition((src) => src.state === 'draft');
        rangeIndex('published', ['hubId', 'publishedAt']).withCondition((src) => src.state === 'published');
        rangeIndex('publishedAll', ['publishedAt']).withCondition((src) => src.state === 'published');

        allowDelete();
    });
}