import * as t from 'io-ts';
import { pipe } from 'fp-ts/lib/pipeable';
import { fold } from 'fp-ts/lib/Either';
import { Props, TypeC } from 'io-ts';

export const decode = <T extends Props>(codec: TypeC<T>, data: unknown) => pipe(codec.decode(data), fold(() => null, (v) => v));

export const ConnectionInitCodec = t.type({
    protocol_v: t.union([t.number, t.undefined]),
    type: t.literal('connection_init'),
    payload: t.unknown
});

export const StopMessageCodec = t.type({
    type: t.literal('stop'),
    id: t.string
});

export const StartMessageCodec = t.type({
    type: t.literal('start'),
    id: t.string,
    payload: t.type({
        query: t.string,
        name: t.union([t.string, t.undefined]),
        variables: t.unknown,
    })
});

export const PingMessageCodec = t.type({
    type: t.literal('ping')
});

export const PongMessageCodec = t.type({
    type: t.literal('ping')
});
