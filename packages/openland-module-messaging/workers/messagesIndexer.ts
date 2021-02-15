import { inTx } from '@openland/foundationdb';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { Store } from 'openland-module-db/FDB';
import { Modules } from '../../openland-modules/Modules';

export function messagesIndexer() {
    declareSearchIndexer({
        name: 'message-index',
        // version: 15,
        version: 13,
        index: 'message',
        stream: Store.Message.updated.stream({ batchSize: 200 })
    }).withProperties({
        id: {
            type: 'integer'
        },
        cid: {
            type: 'integer',
        },
        oid: {
            type: 'integer'
        },
        roomKind: {
            type: 'keyword'
        },
        uid: {
            type: 'integer'
        },
        name: {
            type: 'text'
        },
        isService: {
            type: 'boolean'
        },
        isTest: {
            type: 'boolean'
        },
        deleted: {
            type: 'boolean'
        },
        privateVisibleFor: {
            type: 'integer'
        },
        text: {
            type: 'text',
            analyzer: 'hashtag',
        },
        haveLinkAttachment: {
            type: 'boolean'
        },
        haveImageAttachment: {
            type: 'boolean'
        },
        haveDocumentAttachment: {
            type: 'boolean'
        },
        haveVideoAttachment: {
            type: 'boolean'
        },
        createdAt: {
            type: 'date'
        },
        updatedAt: {
            type: 'date'
        },
    }).withSettings({
        analysis: {
            char_filter: {
                space_hashtags: {
                    type: 'mapping',
                    mappings: ['#=>|#']
                }
            },
            filter: {
                hashtag_as_alphanum: {
                    type: 'word_delimiter',
                    type_table: ['# => ALPHANUM', '@ => ALPHANUM']
                }
            },
            analyzer: {
                hashtag: {
                    type: 'custom',
                    char_filter: 'space_hashtags',
                    tokenizer: 'whitespace',
                    filter: ['lowercase', 'hashtag_as_alphanum']
                }
            }
        }
    }).start(async (item, parent) => {
        return await inTx(parent, async (ctx) => {
            let room = await Store.Conversation.findById(ctx, item.cid);
            let convRoom = await Store.ConversationRoom.findById(ctx, item.cid);
            let userName = await Modules.Users.getUserFullName(ctx, item.uid);

            let haveLinkAttachment = false;
            let haveImageAttachment = false;
            let haveDocumentAttachment = false;
            let haveVideoAttachment = false;

            if (item.augmentation) {
                haveLinkAttachment = true;
            }

            if (item.fileId) {
                if (item.fileMetadata && item.fileMetadata.isImage) {
                    haveImageAttachment = true;
                } else if (item.fileMetadata && item.fileMetadata.mimeType.startsWith('video/')) {
                    haveVideoAttachment = true;
                } else if (item.fileId) {
                    haveDocumentAttachment = true;
                }
            } else if (item.attachments) {
                for (let attach of item.attachments) {
                    if (attach.fileMetadata && attach.fileMetadata.isImage) {
                        haveImageAttachment = true;
                    } else if (attach.fileMetadata && attach.fileMetadata.mimeType.startsWith('video/')) {
                        haveVideoAttachment = true;
                    } else if (attach.fileId) {
                        haveDocumentAttachment = true;
                    }
                }
            } else if (item.attachmentsModern) {
                for (let attach of item.attachmentsModern) {
                    if (attach.type === 'file_attachment') {
                        if (attach.fileMetadata && attach.fileMetadata.isImage) {
                            haveImageAttachment = true;
                        } else if (attach.fileMetadata && attach.fileMetadata.mimeType.startsWith('video/')) {
                            haveVideoAttachment = true;
                        } else if (attach.fileId) {
                            haveDocumentAttachment = true;
                        }
                    } else if (attach.type === 'rich_attachment') {
                        haveLinkAttachment = true;
                    }
                }
            }

            let privateVisibleFor = [];

            if (room?.kind === 'private') {
                let privateChat = (await Store.ConversationPrivate.findById(ctx, room.id))!;
                let copy1 = await Store.PrivateMessage.findById(ctx, item.id, privateChat.uid1);
                let copy2 = await Store.PrivateMessage.findById(ctx, item.id, privateChat.uid2);

                if (!copy1?.deleted) {
                    privateVisibleFor.push(privateChat.uid1);
                }
                if (!copy2?.deleted) {
                    privateVisibleFor.push(privateChat.uid2);
                }
            }

            return {
                id: item.id,
                doc: {
                    id: item.id,
                    cid: item.cid,
                    oid: convRoom?.oid || 0,
                    uid: item.uid,
                    name: userName,
                    roomKind: room ? room.kind : 'unknown',
                    isService: !!item.isService,
                    isTest: await Modules.Users.isTest(ctx, item.uid),
                    deleted: !!item.deleted,
                    privateVisibleFor,
                    text: item.text || undefined,
                    createdAt: item.metadata.createdAt,
                    updatedAt: item.metadata.updatedAt,
                    haveLinkAttachment,
                    haveImageAttachment,
                    haveDocumentAttachment,
                    haveVideoAttachment
                }
            };
        });
    });
}