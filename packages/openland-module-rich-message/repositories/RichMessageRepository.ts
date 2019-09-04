import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { fetchNextDBSeq } from '../../openland-utils/dbSeq';
import {
    AllMentionSpan,
    BoldTextSpan, CodeBlockTextSpan,
    DateTextSpan, InlineCodeTextSpan, InsaneTextSpan, IronyTextSpan, ItalicTextSpan,
    LinkSpan, LoudTextSpan, MessageAttachment, MessageAttachmentInput,
    MultiUserMentionSpan, RoomMentionSpan, RotatingTextSpan,
    UserMentionSpan
} from '../../openland-module-messaging/MessageInput';
import * as Chrono from 'chrono-node';
import { createLinkifyInstance } from '../../openland-utils/createLinkifyInstance';
import { inTx } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { RandomLayer } from '@openland/foundationdb-random';
import { UserError } from '../../openland-errors/UserError';

const linkifyInstance = createLinkifyInstance();

export type RichMessageSpan =
    UserMentionSpan |
    MultiUserMentionSpan |
    RoomMentionSpan |
    LinkSpan |
    BoldTextSpan |
    ItalicTextSpan |
    IronyTextSpan |
    InlineCodeTextSpan |
    CodeBlockTextSpan |
    InsaneTextSpan |
    LoudTextSpan |
    RotatingTextSpan |
    DateTextSpan |
    AllMentionSpan;

export interface RichMessageInput {
    repeatKey?: string | null;
    message?: string | null;
    replyToComment?: number | null;
    spans?: RichMessageSpan[] | null;
    attachments?: MessageAttachmentInput[] | null;
    ignoreAugmentation?: boolean | null;

    // appends attachments instead of replacing them in editComment
    appendAttachments?: boolean | null;
}

export type RichMessageReaction = 'LIKE' | 'THUMB_UP' | 'JOY' | 'SCREAM' | 'CRYING' | 'ANGRY';

@injectable()
export class RichMessageRepository {
    async createRichMessage(parent: Context, uid: number, messageInput: RichMessageInput) {
        return await inTx(parent, async (ctx) => {
            //
            // Parse links
            //
            let spans = messageInput.spans ? [...messageInput.spans] : [];
            let links = this.parseLinks(messageInput.message || '');
            if (links.length > 0) {
                spans.push(...links);
            }
            //
            // Parse dates
            //
            let dates = this.parseDates(messageInput.message || '');
            if (dates.length > 0) {
                spans.push(...dates);
            }

            //
            // Prepare attachments
            //
            let attachments: MessageAttachment[] = await this.prepareAttachments(ctx, messageInput.attachments || []);

            //
            //  Create comment
            //
            let messageId = await this.fetchNextRichMessageId(ctx);
            let message = await Store.RichMessage.create(ctx, messageId, {
                uid,
                text: messageInput.message || null,
                spans,
                attachments,
            });

            return message;
        });
    }

    async editRichMessage(parent: Context, uid: number, mid: number, newMessage: RichMessageInput, markAsEdited: boolean) {
        return await inTx(parent, async (ctx) => {
            let message = await Store.RichMessage.findById(ctx, mid);
            if (!message) {
                throw new UserError('Message not found');
            }
            //
            // Update message
            //

            if (newMessage.message) {
                message.text = newMessage.message;
            }
            if (markAsEdited) {
                message.edited = true;
            }
            if (newMessage.attachments) {
                if (newMessage.appendAttachments) {
                    message.attachments = [...(message.attachments || []), ...await this.prepareAttachments(ctx, newMessage.attachments || [])];
                } else {
                    message.attachments = await this.prepareAttachments(ctx, newMessage.attachments || []);
                }
            }
            if (newMessage.spans) {
                message.spans = newMessage.spans;
            }
        });
    }

    async setReaction(parent: Context, mid: number, uid: number, reaction: RichMessageReaction, reset: boolean = false) {
        return await inTx(parent, async (ctx) => {
            let message = await Store.RichMessage.findById(ctx, mid);

            if (!message) {
                throw new Error('Message not found');
            }

            //
            // Update message
            //

            let reactions: { reaction: string, userId: number }[] = message.reactions ? [...message.reactions] as any : [];

            if (reactions.find(r => (r.userId === uid) && (r.reaction === reaction))) {
                if (reset) {
                    reactions = reactions.filter(r => !((r.userId === uid) && (r.reaction === reaction)));
                } else {
                    return false;
                }
            } else {
                reactions.push({ userId: uid, reaction });
            }
            message.reactions = reactions;

            return true;
        });
    }

    private async fetchNextRichMessageId(parent: Context) {
        return fetchNextDBSeq(parent, 'rich-message-id');
    }

    private parseLinks(message: string): LinkSpan[] {
        let urls = linkifyInstance.match(message);

        if (!urls) {
            return [];
        }

        let offsets = new Set<number>();

        function getOffset(str: string, n: number = 0): number {
            let offset = message.indexOf(str, n);

            if (offsets.has(offset)) {
                return getOffset(str, n + 1);
            }

            offsets.add(offset);
            return offset;
        }

        return urls.map(url => ({
            type: 'link',
            offset: getOffset(url.raw),
            length: url.raw.length,
            url: url.url,
        } as LinkSpan));
    }

    private parseDates(message: string): DateTextSpan[] {
        let parsed = Chrono.parse(message, new Date());

        return parsed.map(part => {
            return {
                type: 'date_text',
                offset: part.index,
                length: part.text.length,
                date: part.start.date().getTime()
            };
        });
    }

    private async prepareAttachments(parent: Context, attachments: MessageAttachmentInput[]) {
        return await inTx(parent, async (ctx) => {
            let res: MessageAttachment[] = [];

            for (let attachInput of attachments) {
                res.push({
                    ...attachInput,
                    id: Store.storage.db.get(RandomLayer).nextRandomId()
                });
            }

            return res;
        });
    }
}