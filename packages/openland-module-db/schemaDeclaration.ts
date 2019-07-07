import { generate } from '../foundation-orm-gen/generate';
import {
    declareSchema,
    entity,
    field,
    primaryKey,
    enableTimestamps,
    enableVersioning,
    enumField,
    rangeIndex,
    uniqueIndex,
    jsonField,
    directory
} from '../foundation-orm-gen';
import {
    jBool,
    jEnum, jEnumString,
    jField,
    jNumber,
    json,
    jString,
    jVec
} from '../openland-utils/jsonSchema';

const ImageRef = json(() => {
    jField('uuid', jString());
    jField('crop', json(() => {
        jField('x', jNumber());
        jField('y', jNumber());
        jField('w', jNumber());
        jField('h', jNumber());
    })).nullable();
});

const FileInfo = json(() => {
    jField('isImage', jBool());
    jField('isStored', jBool());
    jField('imageWidth', jNumber()).nullable();
    jField('imageHeight', jNumber()).nullable();
    jField('imageFormat', jString()).nullable();
    jField('mimeType', jString());
    jField('name', jString());
    jField('size', jNumber());
});

const basicSpan = (type: string) => json(() => {
    jField('type', jString(type));
    jField('offset', jNumber());
    jField('length', jNumber());
});

const Schema = declareSchema(() => {

    //
    // Conversation
    //

    entity('Conversation', () => {
        primaryKey('id', 'number');
        enumField('kind', ['private', 'organization', 'room']);
        field('deleted', 'boolean').nullable();
        field('archived', 'boolean').nullable();
        enableVersioning();
        enableTimestamps();
    });

    entity('ConversationPrivate', () => {
        primaryKey('id', 'number');
        field('uid1', 'number');
        field('uid2', 'number');
        field('pinnedMessage', 'number').nullable();

        uniqueIndex('users', ['uid1', 'uid2']);
        enableVersioning();
        enableTimestamps();
    });

    entity('ConversationOrganization', () => {
        primaryKey('id', 'number');
        field('oid', 'number');
        uniqueIndex('organization', ['oid']);
        enableVersioning();
        enableTimestamps();
    });

    entity('ConversationRoom', () => {
        primaryKey('id', 'number');
        enumField('kind', ['organization', 'internal', 'public', 'group']);
        field('oid', 'number').nullable();
        field('ownerId', 'number').nullable();
        field('featured', 'boolean').nullable();
        field('listed', 'boolean').nullable();
        field('isChannel', 'boolean').nullable();
        rangeIndex('organization', ['oid'])
            .withCondition((v) => v.kind === 'public' || v.kind === 'internal');
        uniqueIndex('organizationPublicRooms', ['oid', 'id'])
            .withCondition((v) => v.kind === 'public')
            .withRange();
        enableVersioning();
        enableTimestamps();
    });

    entity('RoomProfile', () => {
        primaryKey('id', 'number');

        field('title', 'string');
        field('image', 'json').nullable();
        field('description', 'string').nullable();
        field('socialImage', 'json').nullable();
        field('pinnedMessage', 'number').nullable();
        field('welcomeMessageIsOn', 'boolean').nullable();
        field('welcomeMessageSender', 'number').nullable();
        field('welcomeMessageText', 'string').nullable();

        field('activeMembersCount', 'number').nullable();

        rangeIndex('updated', ['updatedAt']);
        enableVersioning();
        enableTimestamps();
    });

    entity('RoomParticipant', () => {
        primaryKey('cid', 'number');
        primaryKey('uid', 'number');
        field('invitedBy', 'number');
        enumField('role', ['member', 'admin', 'owner']);
        enumField('status', ['joined', 'requested', 'left', 'kicked']);
        uniqueIndex('active', ['cid', 'uid']).withCondition((src) => src.status === 'joined').withRange();
        uniqueIndex('requests', ['cid', 'uid']).withCondition((src) => src.status === 'requested').withRange();
        uniqueIndex('userActive', ['uid', 'cid']).withCondition((src) => src.status === 'joined').withRange();
        enableVersioning();
        enableTimestamps();
    });

    entity('ConversationReceiver', () => {
        primaryKey('cid', 'number');
        primaryKey('uid', 'number');
        field('enabled', 'boolean');
        uniqueIndex('conversation', ['cid', 'uid']).withCondition((src) => src.enabled);
        enableVersioning();
        enableTimestamps();
    });

    //
    // Conversation State
    //

    entity('Message', () => {
        primaryKey('id', 'number');
        field('cid', 'number');
        field('uid', 'number');
        field('repeatKey', 'string').nullable();

        field('text', 'string').nullable().secure();
        jsonField('replyMessages', jVec(jNumber())).nullable();
        field('serviceMetadata', 'json').nullable();
        jsonField('reactions', jVec(json(() => {
            jField('userId', jNumber());
            jField('reaction', jString());
        }))).nullable();
        field('edited', 'boolean').nullable();
        field('isMuted', 'boolean');
        field('isService', 'boolean');
        field('deleted', 'boolean').nullable();
        jsonField('spans', jVec(jEnum(
            json(() => {
                jField('type', jString('user_mention'));
                jField('offset', jNumber());
                jField('length', jNumber());
                jField('user', jNumber());
            }),
            json(() => {
                jField('type', jString('multi_user_mention'));
                jField('offset', jNumber());
                jField('length', jNumber());
                jField('users', jVec(jNumber()));
            }),
            json(() => {
                jField('type', jString('room_mention'));
                jField('offset', jNumber());
                jField('length', jNumber());
                jField('room', jNumber());
            }),
            json(() => {
                jField('type', jString('link'));
                jField('offset', jNumber());
                jField('length', jNumber());
                jField('url', jString());
            }),
            basicSpan('bold_text'),
            basicSpan('italic_text'),
            basicSpan('irony_text'),
            basicSpan('inline_code_text'),
            basicSpan('code_block_text'),
            basicSpan('insane_text'),
            basicSpan('loud_text'),
            basicSpan('rotating_text'),
            json(() => {
                jField('type', jString('date_text'));
                jField('offset', jNumber());
                jField('length', jNumber());
                jField('date', jNumber());
            }),
            basicSpan('all_mention'),
        ))).nullable();
        jsonField('attachmentsModern', jVec(jEnum(
            json(() => {
                jField('type', jString('file_attachment'));
                jField('fileId', jString());
                jField('filePreview', jString()).nullable();
                jField('fileMetadata', FileInfo).nullable();
                jField('id', jString());
            }),
            json(() => {
                jField('type', jString('rich_attachment'));
                jField('title', jString()).nullable();
                jField('subTitle', jString()).nullable();
                jField('titleLink', jString()).nullable();
                jField('text', jString()).nullable();
                jField('icon', ImageRef).nullable();
                jField('image', ImageRef).nullable();
                jField('iconInfo', FileInfo).nullable();
                jField('imageInfo', FileInfo).nullable();
                jField('titleLinkHostname', jString()).nullable();
                jField('keyboard', json(() => {
                    jField('buttons', jVec(jVec(json(() => {
                        jField('title', jString());
                        jField('style', jEnumString('DEFAULT', 'LIGHT'));
                        jField('url', jString()).nullable();
                    }))));
                })).nullable();
                jField('id', jString());
            }),
        ))).nullable();

        // deprecated start
        field('fileId', 'string').nullable().secure();
        jsonField('fileMetadata', json(() => {
            jField('isStored', jBool()).undefinable();
            jField('isImage', jBool()).nullable();
            jField('imageWidth', jNumber()).nullable();
            jField('imageHeight', jNumber()).nullable();
            jField('imageFormat', jString()).nullable();
            jField('mimeType', jString());
            jField('name', jString());
            jField('size', jNumber());
        })).nullable().secure();
        field('filePreview', 'string').nullable().secure();
        field('augmentation', 'json').nullable();
        field('mentions', 'json').nullable();
        field('attachments', 'json').nullable();
        field('buttons', 'json').nullable();
        field('type', 'string').nullable();
        field('title', 'string').nullable();
        field('postType', 'string').nullable();
        field('complexMentions', 'json').nullable();
        // deprecated end

        rangeIndex('chat', ['cid', 'id']).withCondition((src) => !src.deleted);
        rangeIndex('updated', ['updatedAt']);
        uniqueIndex('repeat', ['uid', 'cid', 'repeatKey']).withCondition((src) => !!src.repeatKey);
        enableVersioning();
        enableTimestamps();
    });

    //
    // Comments
    //

    entity('Comment', () => {
        primaryKey('id', 'number');
        field('peerId', 'number');
        enumField('peerType', ['message']);
        field('parentCommentId', 'number').nullable();
        field('uid', 'number');

        field('text', 'string').nullable().secure();
        jsonField('reactions', jVec(json(() => {
            jField('userId', jNumber());
            jField('reaction', jString());
        }))).nullable();
        jsonField('spans', jVec(jEnum(
            json(() => {
                jField('type', jString('user_mention'));
                jField('offset', jNumber());
                jField('length', jNumber());
                jField('user', jNumber());
            }),
            json(() => {
                jField('type', jString('multi_user_mention'));
                jField('offset', jNumber());
                jField('length', jNumber());
                jField('users', jVec(jNumber()));
            }),
            json(() => {
                jField('type', jString('room_mention'));
                jField('offset', jNumber());
                jField('length', jNumber());
                jField('room', jNumber());
            }),
            json(() => {
                jField('type', jString('link'));
                jField('offset', jNumber());
                jField('length', jNumber());
                jField('url', jString());
            }),
            basicSpan('bold_text'),
            basicSpan('italic_text'),
            basicSpan('irony_text'),
            basicSpan('inline_code_text'),
            basicSpan('code_block_text'),
            basicSpan('insane_text'),
            basicSpan('loud_text'),
            basicSpan('rotating_text'),
            json(() => {
                jField('type', jString('date_text'));
                jField('offset', jNumber());
                jField('length', jNumber());
                jField('date', jNumber());
            }),
            basicSpan('all_mention'),
        ))).nullable();
        jsonField('attachments', jVec(jEnum(
            json(() => {
                jField('type', jString('file_attachment'));
                jField('fileId', jString());
                jField('filePreview', jString()).nullable();
                jField('fileMetadata', FileInfo).nullable();
                jField('id', jString());
            }),
            json(() => {
                jField('type', jString('rich_attachment'));
                jField('title', jString()).nullable();
                jField('subTitle', jString()).nullable();
                jField('titleLink', jString()).nullable();
                jField('text', jString()).nullable();
                jField('icon', ImageRef).nullable();
                jField('image', ImageRef).nullable();
                jField('iconInfo', FileInfo).nullable();
                jField('imageInfo', FileInfo).nullable();
                jField('titleLinkHostname', jString()).nullable();
                jField('keyboard', json(() => {
                    jField('buttons', jVec(jVec(json(() => {
                        jField('title', jString());
                        jField('style', jEnumString('DEFAULT', 'LIGHT'));
                        jField('url', jString()).nullable();
                    }))));
                })).nullable();
                jField('id', jString());
            }),
        ))).nullable();

        field('deleted', 'boolean').nullable();
        field('edited', 'boolean').nullable();
        field('visible', 'boolean').nullable();

        rangeIndex('peer', ['peerType', 'peerId', 'id']);
        rangeIndex('child', ['parentCommentId', 'id']);
        enableVersioning();
        enableTimestamps();
    });

    entity('CommentState', () => {
        primaryKey('peerType', 'string');
        primaryKey('peerId', 'number');
        field('commentsCount', 'number');
    });

    entity('CommentSeq', () => {
        primaryKey('peerType', 'string');
        primaryKey('peerId', 'number');
        field('seq', 'number');
    });

    entity('CommentEvent', () => {
        primaryKey('peerType', 'string');
        primaryKey('peerId', 'number');
        primaryKey('seq', 'number');
        field('uid', 'number').nullable();
        field('commentId', 'number').nullable();
        enumField('kind', ['comment_received', 'comment_updated']);
        rangeIndex('user', ['peerType', 'peerId', 'seq']).withStreaming();
        enableVersioning();
        enableTimestamps();
    });

    entity('CommentsSubscription', () => {
        primaryKey('peerType', 'string');
        primaryKey('peerId', 'number');
        primaryKey('uid', 'number');
        enumField('kind', ['all', 'direct']);
        enumField('status', ['active', 'disabled']);

        rangeIndex('peer', ['peerType', 'peerId', 'uid']);
    });

    entity('CommentEventGlobal', () => {
        primaryKey('uid', 'number');
        primaryKey('seq', 'number');
        field('peerType', 'string').nullable();
        field('peerId', 'number').nullable();
        enumField('kind', ['comments_peer_updated']);
        rangeIndex('user', ['uid', 'seq']).withStreaming();
        enableVersioning();
        enableTimestamps();
    });

    //
    //  Comments end
    //

    entity('ConversationSeq', () => {
        primaryKey('cid', 'number');
        field('seq', 'number');
    });

    entity('ConversationEvent', () => {
        primaryKey('cid', 'number');
        primaryKey('seq', 'number');
        field('uid', 'number').nullable();
        field('mid', 'number').nullable();
        enumField('kind', ['chat_updated', 'message_received', 'message_updated', 'message_deleted']);
        rangeIndex('user', ['cid', 'seq']).withStreaming();
        enableVersioning();
        enableTimestamps();
    });

    //
    // User Messaging state
    //

    entity('UserDialog', () => {
        primaryKey('uid', 'number');
        primaryKey('cid', 'number');
        field('unread', 'number');
        field('readMessageId', 'number').nullable();
        field('date', 'number').nullable();
        field('haveMention', 'boolean').nullable();

        field('title', 'string').nullable();
        field('photo', 'json').nullable();

        field('hidden', 'boolean').nullable();
        field('disableGlobalCounter', 'boolean').nullable();

        rangeIndex('user', ['uid', 'date'])
            .withCondition((src) => !!src.date && !src.hidden)
            .withDisplayName('dialogsForUser');
        uniqueIndex('conversation', ['cid', 'uid'])
            .withRange();
        rangeIndex('updated', ['updatedAt']);
        enableTimestamps();
        enableVersioning();
    });

    entity('UserDialogHandledMessage', () => {
        primaryKey('uid', 'number');
        primaryKey('cid', 'number');
        primaryKey('mid', 'number');
        enableTimestamps();
        enableVersioning();
    });

    entity('UserDialogSettings', () => {
        primaryKey('uid', 'number');
        primaryKey('cid', 'number');
        field('mute', 'boolean');
        enableTimestamps();
        enableVersioning();
    });

    entity('UserDialogEvent', () => {
        primaryKey('uid', 'number');
        primaryKey('seq', 'number');
        field('cid', 'number').nullable();
        field('mid', 'number').nullable();
        field('allUnread', 'number').nullable();
        field('unread', 'number').nullable();
        field('title', 'string').nullable();
        field('photo', 'json').nullable();
        field('mute', 'boolean').nullable();
        field('haveMention', 'boolean').nullable();
        enumField('kind', ['message_received', 'message_updated', 'message_deleted', 'message_read', 'title_updated', 'dialog_deleted', 'dialog_bump', 'photo_updated', 'dialog_mute_changed', 'dialog_mentioned_changed']);
        rangeIndex('user', ['uid', 'seq']).withStreaming();
        enableVersioning();
        enableTimestamps();
    });

    entity('UserMessagingState', () => {
        primaryKey('uid', 'number');
        field('seq', 'number');
        field('unread', 'number');
        field('messagesSent', 'number').nullable();
        field('messagesReceived', 'number').nullable();
        field('chatsCount', 'number').nullable();
        field('directChatsCount', 'number').nullable();

        rangeIndex('hasUnread', []).withCondition((src) => src.unread && src.unread > 0);
        enableVersioning();
        enableTimestamps();
    });

    entity('UserNotificationsState', () => {
        primaryKey('uid', 'number');
        field('readSeq', 'number').nullable();
        field('lastEmailNotification', 'number').nullable();
        field('lastPushNotification', 'number').nullable();
        field('lastEmailSeq', 'number').nullable();
        field('lastPushSeq', 'number').nullable();
        enableVersioning();
        enableTimestamps();
    });

    directory('NeedNotificationFlag');

    entity('ChatAudienceCalculatingQueue', () => {
        primaryKey('id', 'number');
        field('active', 'boolean');
        field('delta', 'number');
        rangeIndex('active', ['createdAt']).withCondition((src) => !!src.active);
        enableVersioning();
        enableTimestamps();
    });
});

generate(Schema, __dirname + '/../openland-module-db/schema.ts');