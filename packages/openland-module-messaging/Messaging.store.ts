import {
    array,
    boolean, customDirectory, entity,
    field,
    integer,
    json,
    optional, primaryKey,
    rangeIndex,
    string,
    struct,
    union, uniqueIndex
} from '@openland/foundationdb-compiler';
import {
    basicSpan,
    FileAttachment,
    ImageRef,
    PurchaseAttachment,
    RichAttachment
} from '../openland-module-db/store.schema';
import { MessageShape } from '../openland-module-db/store';

function hasImageAttachment(item: MessageShape) {
    if (item.deleted) {
        return false;
    }

    if (item.fileId) {
        if (item.fileMetadata && item.fileMetadata.isImage) {
            return true;
        }
    }
    if (item.attachments) {
        for (let attach of item.attachments) {
            if (attach.fileMetadata && attach.fileMetadata.isImage) {
                return true;
            }
        }
    }
    if (item.attachmentsModern) {
        for (let attach of item.attachmentsModern) {
            if (attach.type === 'file_attachment') {
                if (attach.fileMetadata && attach.fileMetadata.isImage) {
                    return true;
                }
            }
        }
    }
    return false;
}

function hasLinkAttachment(item: MessageShape) {
    if (item.deleted) {
        return false;
    }

    if (item.augmentation) {
        return true;
    }

    if (item.attachmentsModern) {
        for (let attach of item.attachmentsModern) {
            if (attach.type === 'rich_attachment') {
                return true;
            }
        }
    }
    return false;
}

function hasVideoAttachment(item: MessageShape) {
    if (item.deleted) {
        return false;
    }

    if (item.fileId && item.fileMetadata && item.fileMetadata.mimeType.startsWith('video/')) {
        return true;
    }
    if (item.attachments) {
        for (let attach of item.attachments) {
            if (attach.fileMetadata && attach.fileMetadata.mimeType.startsWith('video/')) {
                return true;
            }
        }
    }
    if (item.attachmentsModern) {
        for (let attach of item.attachmentsModern) {
            if (attach.type === 'file_attachment' && attach.fileMetadata && attach.fileMetadata.mimeType.startsWith('video/')) {
                return true;
            }
        }
    }
    return false;
}

function hasDocumentAttachment(item: MessageShape) {
    if (item.deleted) {
        return false;
    }

    if (item.fileId) {
        if (item.fileMetadata && !item.fileMetadata.isImage && !item.fileMetadata.mimeType.startsWith('video/')) {
            return true;
        }
    }
    if (item.attachments) {
        for (let attach of item.attachments) {
            if (attach.fileMetadata && !attach.fileMetadata.isImage && !attach.fileMetadata.mimeType.startsWith('video/')) {
                return true;
            }
        }
    }
    if (item.attachmentsModern) {
        for (let attach of item.attachmentsModern) {
            if (attach.type === 'file_attachment') {
                if (attach.fileMetadata && !attach.fileMetadata.isImage && !attach.fileMetadata.mimeType.startsWith('video/')) {
                    return true;
                }
            }
        }
    }
    return false;
}

export function messagingStore() {
    const CommonMessageFields = () => {
        field('cid', integer());
        field('uid', integer());
        field('seq', integer());
        field('repeatKey', optional(string()));

        field('text', optional(string())).secure();
        field('replyMessages', optional(array(integer())));
        field('serviceMetadata', optional(json()));
        field('reactions', optional(array(struct({
            userId: integer(), reaction: string(),
        }))));
        field('edited', optional(boolean()));
        field('isMuted', boolean());
        field('isService', boolean());
        field('visibleOnlyForUids', optional(array(integer())));
        field('hiddenForUids', optional(array(integer())));
        field('deleted', optional(boolean()));
        field('spans', optional(array(union({
            user_mention: struct({
                offset: integer(), length: integer(), user: integer(),
            }),
            multi_user_mention: struct({
                offset: integer(), length: integer(), users: array(integer()),
            }),
            room_mention: struct({
                offset: integer(), length: integer(), room: integer(),
            }),
            organization_mention: struct({
                offset: integer(), length: integer(), organization: integer(),
            }),
            link: struct({
                offset: integer(), length: integer(), url: string(),
            }),
            date_text: struct({
                offset: integer(), length: integer(), date: integer(),
            }),
            bold_text: basicSpan,
            italic_text: basicSpan,
            irony_text: basicSpan,
            inline_code_text: basicSpan,
            code_block_text: basicSpan,
            insane_text: basicSpan,
            loud_text: basicSpan,
            rotating_text: basicSpan,
            all_mention: basicSpan,
            hash_tag: struct({
                offset: integer(), length: integer(), tag: string(),
            }),
        }))));
        field('attachmentsModern', optional(array(union({
            file_attachment: FileAttachment,
            rich_attachment: RichAttachment,
            purchase_attachment: PurchaseAttachment
        }))));
        field('stickerId', optional(string()));

        // overrides
        field('overrideAvatar', optional(ImageRef));
        field('overrideName', optional(string()));

        // deprecated start
        field('fileId', optional(string())).secure();
        field('fileMetadata', optional(struct({
            name: string(),
            size: integer(),
            isStored: optional(boolean()),
            isImage: optional(boolean()),
            imageWidth: optional(integer()),
            imageHeight: optional(integer()),
            imageFormat: optional(string()),
            mimeType: string(),
        }))).secure();
        field('filePreview', optional(string())).secure();
        field('augmentation', optional(json()));
        field('mentions', optional(json()));
        field('attachments', optional(json()));
        field('buttons', optional(json()));
        field('type', optional(string()));
        field('title', optional(string()));
        field('postType', optional(string()));
        field('complexMentions', optional(json()));
        // deprecated end
    };

    entity('Message', () => {
        primaryKey('id', integer());
        CommonMessageFields();
        rangeIndex('chat', ['cid', 'id']).withCondition((src) => !src.deleted);
        rangeIndex('chatAll', ['cid', 'id']);
        rangeIndex('chatSeq', ['cid', 'seq']).withCondition((src) => !src.deleted);
        // rangeIndex('fromSeq', ['cid', 'seq']);
        rangeIndex('hasImageAttachment', ['cid', 'id']).withCondition(hasImageAttachment);
        rangeIndex('hasLinkAttachment', ['cid', 'id']).withCondition(hasLinkAttachment);
        rangeIndex('hasVideoAttachment', ['cid', 'id']).withCondition(hasVideoAttachment);
        rangeIndex('hasDocumentAttachment', ['cid', 'id']).withCondition(hasDocumentAttachment);
        uniqueIndex('repeat', ['uid', 'cid', 'repeatKey']).withCondition((src) => !!src.repeatKey);
        rangeIndex('updated', ['updatedAt']);
        rangeIndex('created', ['createdAt']);
    });

    entity('PrivateMessage', () => {
        primaryKey('id', integer());
        primaryKey('inboxUid', integer());
        CommonMessageFields();
        rangeIndex('chat', ['cid', 'inboxUid', 'id']).withCondition((src) => !src.deleted);
        rangeIndex('chatAll', ['cid', 'inboxUid', 'id']);
        rangeIndex('chatSeq', ['cid', 'inboxUid', 'seq']).withCondition((src) => !src.deleted);
        rangeIndex('hasImageAttachment', ['cid', 'inboxUid', 'id']).withCondition(hasImageAttachment);
        rangeIndex('hasLinkAttachment', ['cid', 'inboxUid', 'id']).withCondition(hasLinkAttachment);
        rangeIndex('hasVideoAttachment', ['cid', 'inboxUid', 'id']).withCondition(hasVideoAttachment);
        rangeIndex('hasDocumentAttachment', ['cid', 'inboxUid', 'id']).withCondition(hasDocumentAttachment);
        rangeIndex('updated', ['updatedAt']);
        rangeIndex('created', ['createdAt']);
    });

    customDirectory('PrivateChatsDeletedTo');
}