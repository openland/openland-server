import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { GQL } from 'openland-module-api/schema/SchemaSpec';
import { IDs } from 'openland-module-api/IDs';
import { JsonMap } from 'openland-utils/json';
import { validate, defined, stringNotEmpty, isNumber } from 'openland-utils/NewInputValidator';
import { NotFoundError } from 'openland-errors/NotFoundError';

export default {
    Mutation: {
        roomRead: withUser<GQL.MutationRoomReadArgs>(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.id);
            let mid = IDs.ConversationMessage.parse(args.mid);
            await Modules.Messaging.readRoom(ctx, uid, cid, mid);
            return true;
        }),

        betaMessageSend: withUser<GQL.MutationBetaMessageSendArgs>(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.room);
            let replyMessages = args.replyMessages && args.replyMessages.map(id => IDs.ConversationMessage.parse(id));
            let mentions = args.mentions && args.mentions.map(id => IDs.User.parse(id));

            // Prepare files
            let fileMetadata: JsonMap | null = null;
            let filePreview: string | null = null;
            if (args.file) {
                let fileInfo = await Modules.Media.saveFile(args.file);
                fileMetadata = fileInfo as any;

                if (fileInfo.isImage) {
                    filePreview = await Modules.Media.fetchLowResPreview(args.file);
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
        betaMessageEdit: withUser<GQL.MutationBetaMessageEditArgs>(async (ctx, args, uid) => {

            // Resolve arguments
            let mid = IDs.ConversationMessage.parse(args.mid);
            let replyMessages = args.replyMessages && args.replyMessages.map(id => IDs.ConversationMessage.parse(id));
            let mentions = args.mentions && args.mentions.map(id => IDs.User.parse(id));
            let fileMetadata: JsonMap | null = null;
            let filePreview: string | null = null;
            if (args.file) {
                let fileInfo = await Modules.Media.saveFile(args.file);
                fileMetadata = fileInfo as any;

                if (fileInfo.isImage) {
                    filePreview = await Modules.Media.fetchLowResPreview(args.file);
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
        betaMessageDelete: withUser<GQL.MutationBetaMessageDeleteArgs>(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.mid);
            await Modules.Messaging.deleteMessage(ctx, messageId, uid);
            return true;
        }),
        betaMessageDeleteAugmentation: withUser<GQL.MutationBetaMessageDeleteAugmentationArgs>(async (ctx, args, uid) => {
            await Modules.Messaging.editMessage(ctx, IDs.ConversationMessage.parse(args.mid), uid, {
                urlAugmentation: false
            }, false);
            return true;
        }),

        betaReactionSet: withUser<GQL.MutationBetaReactionSetArgs>(async (ctx, args, uid) => {
            await Modules.Messaging.setReaction(ctx, IDs.ConversationMessage.parse(args.mid), uid, args.reaction);
            return true;
        }),
        betaReactionRemove: withUser<GQL.MutationBetaReactionRemoveArgs>(async (ctx, args, uid) => {
            await Modules.Messaging.setReaction(ctx, IDs.ConversationMessage.parse(args.mid), uid, args.reaction, true);
            return true;
        }),

        betaIntroSend: withUser<GQL.MutationBetaIntroSendArgs>(async (ctx, args, uid) => {
            await validate({
                about: defined(stringNotEmpty(`About can't be empty!`)),
                userId: defined(isNumber('Select user'))
            }, args);

            let userId = IDs.User.parse(args.uid);
            let cid = IDs.Conversation.parse(args.room);

            let fileMetadata: JsonMap | null = null;
            let filePreview: string | null = null;

            if (args.file) {
                let fileInfo = await Modules.Media.saveFile(args.file);
                fileMetadata = fileInfo as any;

                if (fileInfo.isImage) {
                    filePreview = await Modules.Media.fetchLowResPreview(args.file);
                }
            }

            let profile = (await Modules.Users.profileById(ctx, userId))!;
            if (!profile) {
                throw new NotFoundError();
            }

            return (await Modules.Messaging.sendMessage(ctx, cid, uid!, {
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
            }));
        }),
        betaIntroEdit: withUser<GQL.MutationBetaIntroEditArgs>(async (ctx, args, uid) => {
            await validate({
                about: defined(stringNotEmpty(`About can't be empty!`)),
                userId: defined(isNumber('Select user'))
            }, args);

            let userId = IDs.User.parse(args.uid);
            let messageId = IDs.ConversationMessage.parse(args.mid);

            let fileMetadata: JsonMap | null = null;
            let filePreview: string | null = null;

            if (args.file) {
                let fileInfo = await Modules.Media.saveFile(args.file);
                fileMetadata = fileInfo as any;

                if (fileInfo.isImage) {
                    filePreview = await Modules.Media.fetchLowResPreview(args.file);
                }
            }

            let profile = (await Modules.Users.profileById(ctx, userId))!;

            if (!profile) {
                throw new NotFoundError();
            }

            return await Modules.Messaging.editMessage(ctx, messageId, uid!, {
                message: args.message,
                file: args.file,
                fileMetadata,
                filePreview,
                urlAugmentation: {
                    type: 'intro',
                    extra: args.uid,
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
        })
    }
};