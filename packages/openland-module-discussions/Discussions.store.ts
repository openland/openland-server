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

const DiscussionContent = union({
    text: struct({
        text: string(),
        spans: Spans
    }),
    image: struct({
        image: Image
    }),
    h1: struct({ text: string() }),
    h2: struct({ text: string() }),
});

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
        field('state', enumString('published', 'archived'));
        field('publishedAt', optional(integer()));
        field('editedAt', optional(integer()));
        field('archivedAt', optional(integer()));
        field('version', integer());

        field('title', string());
        field('content', optional(array(DiscussionContent)));

        rangeIndex('published', ['hubId', 'publishedAt']).withCondition((src) => src.state === 'published');
        rangeIndex('publishedAll', ['publishedAt']).withCondition((src) => src.state === 'published');

        allowDelete();
    });

    entity('DiscussionDraft', () => {
        primaryKey('id', integer());
        field('uid', integer());
        field('hubId', optional(integer()));
        field('state', enumString('draft', 'archived'));
        field('editedAt', optional(integer()));
        field('archivedAt', optional(integer()));
        field('version', integer());

        field('title', string());
        field('content', optional(array(DiscussionContent)));

        rangeIndex('draft', ['uid', 'updatedAt']).withCondition((src) => src.state === 'draft');

        allowDelete();
    });
}