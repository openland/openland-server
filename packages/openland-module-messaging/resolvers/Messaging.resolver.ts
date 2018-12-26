import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { IDs } from 'openland-module-api/IDs';
import { JsonMap } from 'openland-utils/json';
import { validate, defined, stringNotEmpty, isNumber } from 'openland-utils/NewInputValidator';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { withLogContext } from '../../openland-log/withLogContext';
import { MessageAttachment } from '../MessageInput';
import { PostTemplates, PostTextTemplate } from '../texts/PostTemplates';
import { inTx } from '../../foundation-orm/inTx';
import { FDB } from '../../openland-module-db/FDB';

export default {
    Mutation: {
        roomRead: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.id);
            let mid = IDs.ConversationMessage.parse(args.mid);
            await Modules.Messaging.readRoom(ctx, uid, cid, mid);
            return true;
        }),

        betaMessageSend: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.room);
            let replyMessages = args.replyMessages && args.replyMessages.map(id => IDs.ConversationMessage.parse(id));
            let mentions = args.mentions && args.mentions.map(id => IDs.User.parse(id));

            // Prepare files
            let fileMetadata: JsonMap | null = null;
            let filePreview: string | null = null;
            if (args.file) {
                let fileInfo = await Modules.Media.saveFile(ctx, args.file);
                fileMetadata = fileInfo as any;

                if (fileInfo.isImage) {
                    filePreview = await Modules.Media.fetchLowResPreview(ctx, args.file);
                }
            }

            // Send message
            await Modules.Messaging.sendMessage(ctx, cid, uid!, {
                message: args.message,
                file: args.file,
                fileMetadata,
                repeatKey: args.repeatKey,
                filePreview,
                replyMessages,
                mentions
            });

            return true;
        }),
        betaMessageEdit: withUser(async (ctx, args, uid) => {

            // Resolve arguments
            let mid = IDs.ConversationMessage.parse(args.mid);
            let replyMessages = args.replyMessages && args.replyMessages.map(id => IDs.ConversationMessage.parse(id));
            let mentions = args.mentions && args.mentions.map(id => IDs.User.parse(id));
            let fileMetadata: JsonMap | null = null;
            let filePreview: string | null = null;
            if (args.file) {
                let fileInfo = await Modules.Media.saveFile(ctx, args.file);
                fileMetadata = fileInfo as any;

                if (fileInfo.isImage) {
                    filePreview = await Modules.Media.fetchLowResPreview(ctx, args.file);
                }
            }

            await Modules.Messaging.editMessage(ctx, mid, uid, {
                message: args.message,
                file: args.file,
                fileMetadata,
                filePreview,
                replyMessages,
                mentions
            }, true);
            return true;
        }),
        betaMessageDelete: withUser(async (ctx, args, uid) => {
            if (args.mid) {
                let messageId = IDs.ConversationMessage.parse(args.mid);
                await Modules.Messaging.deleteMessage(ctx, messageId, uid);
                return true;
            } else if (args.mids) {
                let messageIds = args.mids.map(mid => IDs.ConversationMessage.parse(mid));
                await Modules.Messaging.deleteMessages(ctx, messageIds, uid);
                return true;
            }
            return false;

        }),
        betaMessageDeleteAugmentation: withUser(async (ctx, args, uid) => {
            await Modules.Messaging.editMessage(ctx, IDs.ConversationMessage.parse(args.mid), uid, {
                urlAugmentation: false
            }, false);
            return true;
        }),

        betaReactionSet: withUser(async (ctx, args, uid) => {
            await Modules.Messaging.setReaction(ctx, IDs.ConversationMessage.parse(args.mid), uid, args.reaction);
            return true;
        }),
        betaReactionRemove: withUser(async (ctx, args, uid) => {
            await Modules.Messaging.setReaction(ctx, IDs.ConversationMessage.parse(args.mid), uid, args.reaction, true);
            return true;
        }),

        betaIntroSend: withUser(async (ctx, args, uid) => {
            await validate({
                about: defined(stringNotEmpty(`About can't be empty!`)),
                uid: defined(isNumber('Select user'))
            }, { ...args, uid: IDs.User.parse(args.uid) });

            let userId = IDs.User.parse(args.uid);
            let cid = IDs.Conversation.parse(args.room);

            let fileMetadata: JsonMap | null = null;
            let filePreview: string | null = null;

            if (args.file) {
                let fileInfo = await Modules.Media.saveFile(ctx, args.file);
                fileMetadata = fileInfo as any;

                if (fileInfo.isImage) {
                    filePreview = await Modules.Media.fetchLowResPreview(ctx, args.file);
                }
            }

            let profile = (await Modules.Users.profileById(ctx, userId))!;
            if (!profile) {
                throw new NotFoundError();
            }

            await Modules.Messaging.sendMessage(ctx, cid, uid!, {
                message: args.message,
                file: args.file,
                fileMetadata,
                repeatKey: args.repeatKey,
                filePreview,
                urlAugmentation: {
                    type: 'intro',
                    extra: userId,
                    url: `https://next.openland.com/mail/u/${IDs.User.serialize(userId)}`,
                    title: profile.firstName + ' ' + profile.lastName,
                    subtitle: 'intro',
                    description: args.about || '',
                    imageURL: null,
                    imageInfo: null,
                    photo: profile!.picture,
                    hostname: 'openland.com',
                    iconRef: null,
                    iconInfo: null,
                }
            });
            return true;
        }),
        betaIntroEdit: withUser(async (ctx, args, uid) => {
            await validate({
                about: defined(stringNotEmpty(`About can't be empty!`)),
                uid: defined(isNumber('Select user'))
            }, { ...args, uid: IDs.User.parse(args.uid) });

            let userId = IDs.User.parse(args.uid);
            let messageId = IDs.ConversationMessage.parse(args.mid);

            let fileMetadata: JsonMap | null = null;
            let filePreview: string | null = null;

            if (args.file) {
                let fileInfo = await Modules.Media.saveFile(ctx, args.file);
                fileMetadata = fileInfo as any;

                if (fileInfo.isImage) {
                    filePreview = await Modules.Media.fetchLowResPreview(ctx, args.file);
                }
            }

            let profile = (await Modules.Users.profileById(ctx, userId))!;

            if (!profile) {
                throw new NotFoundError();
            }

            await Modules.Messaging.editMessage(ctx, messageId, uid!, {
                message: args.message,
                file: args.file,
                fileMetadata,
                filePreview,
                urlAugmentation: {
                    type: 'intro',
                    extra: IDs.User.parse(args.uid),
                    url: `https://next.openland.com/mail/u/${IDs.User.serialize(userId)}`,
                    title: profile.firstName + ' ' + profile.lastName,
                    subtitle: 'intro',
                    description: args.about || '',
                    imageURL: null,
                    imageInfo: null,
                    photo: profile!.picture,
                    hostname: 'openland.com',
                    iconRef: null,
                    iconInfo: null,
                }
            }, true);
            return true;
        }),

        //
        // Message Posts
        //

        alphaSendPostMessage: withUser(async (parent, args, uid) => {
            let ctx = withLogContext(parent, ['send-post-message']);
            let conversationId = IDs.Conversation.parse(args.conversationId);

            let attachments: MessageAttachment[] = [];

            if (args.attachments) {
                for (let file of args.attachments) {
                    let fileMetadata: JsonMap | null = null;
                    let filePreview: string | null = null;

                    let fileInfo = await Modules.Media.saveFile(ctx, file);
                    fileMetadata = fileInfo as any;

                    if (fileInfo.isImage) {
                        filePreview = await Modules.Media.fetchLowResPreview(ctx, file);
                    }

                    attachments.push({ fileId: file, filePreview, fileMetadata: fileMetadata || null });
                }
            }

            let postTemplate = (PostTemplates as any)[args.postType];
            if (!postTemplate) {
                throw new Error('Invalid post type');
            }

            return Modules.Messaging.sendMessage(ctx, conversationId, uid!, {
                title: args.title,
                message: args.text,
                attachments: attachments,
                postType: args.postType,
                repeatKey: args.repeatKey,
                buttons: postTemplate.buttons,
                type: 'POST'
            });
        }),
        alphaEditPostMessage: withUser(async (parent, args, uid) => {
            let ctx = withLogContext(parent, ['send-post-message']);
            let messageId = IDs.ConversationMessage.parse(args.messageId);

            let attachments: MessageAttachment[] = [];

            if (args.attachments) {
                for (let file of args.attachments) {
                    let fileMetadata: JsonMap | null = null;
                    let filePreview: string | null = null;

                    let fileInfo = await Modules.Media.saveFile(ctx, file);
                    fileMetadata = fileInfo as any;

                    if (fileInfo.isImage) {
                        filePreview = await Modules.Media.fetchLowResPreview(ctx, file);
                    }

                    attachments.push({ fileId: file, filePreview, fileMetadata: fileMetadata || null });
                }
            }

            let postTemplate = (PostTemplates as any)[args.postType];
            if (!postTemplate) {
                throw new Error('Invalid post type');
            }

            return Modules.Messaging.editMessage(ctx, messageId, uid!, {
                title: args.title,
                message: args.text,
                attachments: attachments,
                postType: args.postType,
                buttons: postTemplate.buttons,
                type: 'POST'
            }, true);
        }),
        alphaRespondPostMessage: withUser(async (parent, args, uid) => {
            return inTx(parent, async ctx => {
                let messageId = IDs.ConversationMessage.parse(args.messageId);
                let message = await FDB.Message.findById(ctx, messageId);

                if (!message) {
                    throw new Error('Post not found');
                }
                if (message.type !== 'POST') {
                    throw new Error('Message is not a post');
                }

                let postTemplate = (PostTemplates as any)[message.postType!];
                let postText: PostTextTemplate = postTemplate[args.buttonId + '_TEXT'];

                if (!postTemplate || !postText) {
                    throw new Error('invalid buttonId');
                }

                let room = await Modules.Messaging.room.resolvePrivateChat(ctx, uid, message.uid);

                let postAuthor = await Modules.Users.profileById(ctx, message.uid);
                let responder = await Modules.Users.profileById(ctx, uid!);
                let chatTitle = await Modules.Messaging.room.resolveConversationTitle(ctx, message.cid, uid!);

                // let isNewChat = (await FDB.Message.rangeFromChat(ctx, room.id, 1, true)).length === 0;

                let textVars =  {
                    post_author: postAuthor!.firstName + ' ' + postAuthor!.lastName,
                    post_title: message.title!,
                    chat: chatTitle,
                    responder: responder!.firstName + ' ' + responder!.lastName,
                    post_author_name: postAuthor!.firstName,
                    responder_name: responder!.firstName
                };

                await Modules.Messaging.sendMessage(ctx, room.id, uid!, {
                    message: postText(textVars),
                    isService: true,
                    complexMentions: [
                        { type: 'User', id: postAuthor!.id },
                        { type: 'User', id: responder!.id },
                        { type: 'SharedRoom', id: message.cid },
                    ],
                    serviceMetadata: {
                        type: 'post_respond',
                        postId: messageId,
                        postRoomId: message.cid,
                        responderId: uid!,
                        respondType: args.buttonId
                    }
                });

                // if (isNewChat) {
                //     await Modules.Messaging.sendMessage(ctx, room.id, uid!, {
                //         message: 'Now you can chat!',
                //         isService: true
                //     });
                // }

                return true;
            });
        })
    }
} as GQLResolver;