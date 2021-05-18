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
    }).start(async (args, parent) => {
        return await inTx(parent, async (ctx) => {
            let room = await Store.Conversation.findById(ctx, args.item.cid);
            let convRoom = await Store.ConversationRoom.findById(ctx, args.item.cid);
            let userName = await Modules.Users.getUserFullName(ctx, args.item.uid);

            let haveLinkAttachment = false;
            let haveImageAttachment = false;
            let haveDocumentAttachment = false;
            let haveVideoAttachment = false;

            if (args.item.augmentation) {
                haveLinkAttachment = true;
            }

            if (args.item.fileId) {
                if (args.item.fileMetadata && args.item.fileMetadata.isImage) {
                    haveImageAttachment = true;
                } else if (args.item.fileMetadata && args.item.fileMetadata.mimeType.startsWith('video/')) {
                    haveVideoAttachment = true;
                } else if (args.item.fileId) {
                    haveDocumentAttachment = true;
                }
            } else if (args.item.attachments) {
                for (let attach of args.item.attachments) {
                    if (attach.fileMetadata && attach.fileMetadata.isImage) {
                        haveImageAttachment = true;
                    } else if (attach.fileMetadata && attach.fileMetadata.mimeType.startsWith('video/')) {
                        haveVideoAttachment = true;
                    } else if (attach.fileId) {
                        haveDocumentAttachment = true;
                    }
                }
            } else if (args.item.attachmentsModern) {
                for (let attach of args.item.attachmentsModern) {
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
                let copy1 = await Store.PrivateMessage.findById(ctx, args.item.id, privateChat.uid1);
                let copy2 = await Store.PrivateMessage.findById(ctx, args.item.id, privateChat.uid2);

                if (!copy1?.deleted) {
                    privateVisibleFor.push(privateChat.uid1);
                }
                if (!copy2?.deleted) {
                    privateVisibleFor.push(privateChat.uid2);
                }
            }

            return {
                id: args.item.id,
                doc: {
                    id: args.item.id,
                    cid: args.item.cid,
                    oid: convRoom?.oid || 0,
                    uid: args.item.uid,
                    name: userName,
                    roomKind: room ? room.kind : 'unknown',
                    isService: !!args.item.isService,
                    isTest: await Modules.Users.isTest(ctx, args.item.uid),
                    deleted: !!args.item.deleted,
                    privateVisibleFor,
                    text: args.item.text || undefined,
                    createdAt: args.item.metadata.createdAt,
                    updatedAt: args.item.metadata.updatedAt,
                    haveLinkAttachment,
                    haveImageAttachment,
                    haveDocumentAttachment,
                    haveVideoAttachment
                }
            };
        });
    });
}