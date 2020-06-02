// @ts-nocheck
import {
    primaryKey,
    integer,
    entity,
    field,
    string,
    optional,
    rangeIndex,
    enumString,
    struct,
    array,
    union,
    allowDelete,
} from '@openland/foundationdb-compiler';
import { basicSpan, Image } from '../openland-module-db/store.schema';

const Spans = array(union({
    link: struct({
        offset: integer(), length: integer(), url: string(),
    }),
    bold_text: basicSpan,
    italic_text: basicSpan,
    irony_text: basicSpan,
}));

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