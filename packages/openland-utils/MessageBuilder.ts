import { MessageInput, MessageSpan, MessageAttachmentInput, MessageRichAttachmentInput, MessageAttachmentFileInput } from '../openland-module-messaging/MessageInput';

export type MessagePart = string
    | { type: 'bold_text', text: string }
    | { type: 'user_mention', text: string, uid: number }
    | { type: 'users_mention', text: string, uids: number[] }
    | ({ type: 'rich_attach', attach: Partial<MessageRichAttachmentInput> })
    | ({ type: 'file_attach', attach: MessageAttachmentFileInput })
    | ({ type: 'loud_text', parts: MessagePart[] })
    | ({ type: 'insane_text', text: string })
    | ({ type: 'room_mention', room: number, text: string })
    | ({ type: 'org_mention', oid: number, text: string })
    | ({ type: 'link', text: string, url: string });

export const boldString = (str: string) => ({ type: 'bold_text', text: str }) as MessagePart;
export const heading = (...parts: MessagePart[]) => ({ type: 'loud_text', parts: parts }) as MessagePart;
export const insaneString = (str: string) => ({ type: 'insane_text', text: str }) as MessagePart;
export const userMention = (str: string, uid: number) => ({ type: 'user_mention', text: str, uid }) as MessagePart;
export const orgMention = (str: string, oid: number) => ({ type: 'org_mention', text: str, oid }) as MessagePart;
export const usersMention = (str: string, uids: number[]) => ({ type: 'users_mention', text: str, uids }) as MessagePart;
export const roomMention = (str: string, room: number) => ({ type: 'room_mention', room, text: str }) as MessagePart;
export const link = (text: string, url: string) => ({ type: 'link', text, url }) as MessagePart;

export function buildMessage(...parts: MessagePart[]): MessageInput {
    let text = '';
    let spans: MessageSpan[] = [];
    let attachments: MessageAttachmentInput[] = [];
    for (let part of parts) {
        let offset = text.length;

        if (typeof part === 'string') {
            text += part;
        } else if (part.type === 'bold_text') {
            spans.push({ type: 'bold_text', offset, length: part.text.length });
            text += part.text;
        } else if (part.type === 'loud_text') {
            const compositeHeader = buildMessage(...part.parts);
            spans.push(...compositeHeader.spans!);
            text += compositeHeader.message!;
            spans.push({ type: 'loud_text', length: compositeHeader.message!.length, offset });
        } else if (part.type === 'user_mention') {
            spans.push({ type: 'user_mention', offset, length: part.text.length, user: part.uid });
            text += part.text;
        } else if (part.type === 'users_mention') {
            spans.push({ type: 'multi_user_mention', offset, length: part.text.length, users: part.uids });
            text += part.text;
        } else if (part.type === 'rich_attach') {
            let richAttach: MessageRichAttachmentInput = {
                type: 'rich_attachment',
                title: null,
                subTitle: null,
                titleLink: null,
                text: null,
                icon: null,
                image: null,
                iconInfo: null,
                imageInfo: null,
                imagePreview: null,
                titleLinkHostname: null,
                keyboard: null,
                imageFallback: null,
                socialImage: null,
                socialImageInfo: null,
                socialImagePreview: null
            };
            richAttach = { ...richAttach, ...part.attach };
            attachments.push(richAttach);
        } else if (part.type === 'file_attach') {
            attachments.push(part.attach);
        } else if (part.type === 'insane_text') {
            spans.push({ type: 'insane_text', offset, length: part.text.length });
            text += part.text;
        } else if (part.type === 'room_mention') {
            spans.push({ type: 'room_mention', offset, length: part.text.length, room: part.room });
            text += part.text;
        } else if (part.type === 'org_mention') {
            spans.push({ type: 'organization_mention', offset, length: part.text.length, organization: part.oid });
            text += part.text;
        } else if (part.type === 'link') {
            spans.push({ type: 'link', offset, length: part.text.length, url: part.url });
            text += part.text;
        }
    }

    return {
        message: text,
        spans,
        attachments: attachments.length ? attachments : undefined,
    };
}