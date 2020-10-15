import { encoders } from '@openland/foundationdb';

const FEED_STREAM = 0; // Event Stream
const FEED_LATEST = 1; // Latest versionstamp
const FEED_SEQ = 2; // Latest seq
const FEED_COLLAPSE = 3;
const FEED_DIRECT = 4;
const FEED_DIRECT_LATEST = 5;
const FEED_ASYNC_ONLINE = 6;
const FEED_COUNTER = 7;
const FEED_COUNTER_DIRECT = 8;
const FEED_COUNTER_ASYNC = 9;

const SUBSCRIBER_SUBSCRIPTIONS = 0;
const SUBSCRIBER_VT = 5;
const SUBSCRIBER_DIRECT = 1;
const SUBSCRIBER_DIRECT_UPDATES = 4;
const SUBSCRIBER_ASYNC = 2;
const SUBSCRIBER_ASYNC_ONLINE_LATEST = 3;
const SUBSCRIBER_SUBSCRIPTIONS_CHANGES = 6;

export const Locations = {
    feed: {
        seq: (feed: Buffer) => encoders.tuple.pack([feed, FEED_SEQ]),
        latest: (feed: Buffer) => encoders.tuple.pack([feed, FEED_LATEST]),
        stream: (feed: Buffer) => encoders.tuple.pack([feed, FEED_STREAM]),
        collapsed: (feed: Buffer, key: string) => encoders.tuple.pack([feed, FEED_COLLAPSE, key])
    },

    subscriber: {

        counterTotal: (feed: Buffer) => encoders.tuple.pack([feed, FEED_COUNTER]),
        counterDirect: (feed: Buffer) => encoders.tuple.pack([feed, FEED_COUNTER_DIRECT]),
        counterAsync: (feed: Buffer) => encoders.tuple.pack([feed, FEED_COUNTER_ASYNC]),

        subscription: (subscriber: Buffer, feed: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_SUBSCRIPTIONS, feed]),
        subscriptionAll: (subscriber: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_SUBSCRIPTIONS]),

        subscriptionVt: (subscriber: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_VT]),

        direct: (subscriber: Buffer, feed: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_DIRECT, feed]),
        directAll: (subscriber: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_DIRECT]),
        directReverse: (subscriber: Buffer, feed: Buffer) => encoders.tuple.pack([feed, FEED_DIRECT, subscriber]),
        directReverseAll: (feed: Buffer) => encoders.tuple.pack([feed, FEED_DIRECT]),
        directUpdates: (subscriber: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_DIRECT_UPDATES]),
        directLatest: (feed: Buffer) => encoders.tuple.pack([feed, FEED_DIRECT_LATEST]),

        async: (subscriber: Buffer, feed: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_ASYNC, feed]),
        asyncAll: (subscriber: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_ASYNC]),
        asyncOnline: (feed: Buffer) => encoders.tuple.pack([feed, FEED_ASYNC_ONLINE]),
        asyncOnlineLatest: (subscriber: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_ASYNC_ONLINE_LATEST]),

        subscriptionChanges: (subscriber: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_SUBSCRIPTIONS_CHANGES])
    }
};