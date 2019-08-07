import { flatMap } from 'openland-utils/flatMap';

const allowedSpans = new Set([
    'user_mention',
    'link',

    'loud_text',
    'bold_text',

    // custom
    'new_line',
    'plain_text'
]);

type MessageUserMention = {
    user: { id: string; name: string; profileLink: string }
} & { type: 'user_mention' };

type MessageLink = {
    url: string
} & { type: 'link' };

type MessageLoud = {
    text: string
} & { type: 'loud_text' };

type MessageBold = {
    text: string
} & { type: 'bold_text' };

type MessageNewLine = {
    text: string
} & { type: 'new_line' };

type MessagePlainText = {
    text: string
} & { type: 'plain_text' };

type MessageSpan =
    MessageUserMention
    | MessageLink
    | MessageLoud
    | MessageBold
    | MessageNewLine
    | MessagePlainText;

export type HandlebarsMessageSpan = {
    [key in MessageSpan['type']]?: true
} & MessageSpan;

export type EmailSpan = {
    offset: number;
    length: number;
    // type: MessageSpan['type']
} & MessageSpan;

const getNewLineSpans = (str: string) => {
    const result = [];
    const re = /\n/g;

    let match: RegExpExecArray | null;

    while (true) {
        match = re.exec(str);
        if (!match) {
            break;
        }

        result.push({
            offset: match.index,
            length: 1,
            type: 'new_line'
        });
    }

    return result;
};

const getPlainTextSpans = (message: string, spans: EmailSpan[]) => flatMap(
    spans.map((span, i) => {
        const msgLen = message.length;

        const currentSpan = span;
        const nextSpan = spans[i + 1] as EmailSpan | undefined;

        let middleSpanOffset: number;
        let middleSpanLength: number;

        if (i === 0 && currentSpan.offset !== 0) {
            middleSpanOffset = 0;
            middleSpanLength = currentSpan.offset;
        } else {
            middleSpanOffset = currentSpan.offset + currentSpan.length;
            middleSpanLength = nextSpan ? nextSpan.offset - middleSpanOffset : msgLen - currentSpan.offset;
        }

        if (middleSpanLength === 0) {
            return [currentSpan];
        }

        // placed between current and next spans
        const middleSpan = {
            offset: middleSpanOffset,
            length: middleSpanLength,
            type: 'plain_text',
        } as EmailSpan;

        return [currentSpan, middleSpan];
    })
);

const fillSpans = (message: string, spans: EmailSpan[]) => {
    return spans.map(span => {

        const { type, length, offset } = span;
        const text = message.substring(offset, offset + length);

        if (
            [
                'loud_text',
                'new_line',
                'plain_text'
            ].includes(span.type)) {
            return {
                text,
                type,
                [type]: true,  // <--- for handlebars
            } as HandlebarsMessageSpan;
        } else if (span.type === 'bold_text') {
            return {
                text: text.replace(/\*/g, ''),
                type,
                [type]: true,
            } as HandlebarsMessageSpan;
        } else if (span.type === 'user_mention') {
            const coersedSpan = span as MessageUserMention;

            return {
                user: {
                    id: coersedSpan.user.id,
                    name: coersedSpan.user.name,
                    profileLink: `https://openland.com/${coersedSpan.user.id}`
                },
                type: span.type,
                [type]: true,
            };
        } else if (span.type === 'link') {
            return {
                url: text,
                type: span.type,
                [type]: true,
            };
        } else {
            return {
                type,
                [type]: true,
            } as HandlebarsMessageSpan;
        }
    });
};

const getFilledSpans = (message: string, spans: EmailSpan[]) => {
    const sortedSpans = [
        ...spans,
        ...getNewLineSpans(message)
    ]
        .filter(span => allowedSpans.has(span.type))
        .sort((a, b) => a.offset - b.offset) as EmailSpan[];

    const spansWithPlainText = getPlainTextSpans(message, sortedSpans);

    const filledSpans = fillSpans(message, spansWithPlainText);

    return filledSpans;
};

export { getFilledSpans }; 