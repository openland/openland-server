import { MessageInput, MessageSpan } from '../openland-module-messaging/MessageInput';

type MessagePart = string | { type: 'bold_text', text: string } | { type: 'user_mention', text: string, uid: number } | { type: 'users_mention', text: string, uids: number[] };

export const boldString = (str: string) => ({ type: 'bold_text', text: str }) as MessagePart;
export const userMention = (str: string, uid: number) => ({ type: 'user_mention', text: str, uid  }) as MessagePart;
export const usersMention = (str: string, uids: number[]) => ({ type: 'users_mention', text: str, uids  }) as MessagePart;

export function buildMessage(...parts: MessagePart[]): MessageInput {
    let text = '';
    let spans: MessageSpan[] = [];

    for (let part of parts) {
        let offset = text.length;

        if (typeof part === 'string') {
            text += part;
        } else if (part.type === 'bold_text') {
            spans.push({ type: 'bold_text', offset, length: part.text.length  });
            text += part.text;
        } else if (part.type === 'user_mention') {
            spans.push({ type: 'user_mention', offset, length: part.text.length, user: part.uid  });
            text += part.text;
        } else if (part.type === 'users_mention') {
            spans.push({ type: 'multi_user_mention', offset, length: part.text.length, users: part.uids  });
            text += part.text;
        }
    }

    return {
        message: text,
        spans
    };
}