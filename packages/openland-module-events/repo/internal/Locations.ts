import { encoders } from '@openland/foundationdb';

const FEED_STREAM = 0; // Event Stream
const FEED_LATEST = 1; // Latest versionstamp
const FEED_SEQ = 2; // Latest seq

const SUBSCRIBER_SUBSCRIPTIONS = 0;
const SUBSCRIBER_SUBSCRIPTIONS_VERSION = 3;
const SUBSCRIBER_DIRECT = 1;
const SUBSCRIBER_DIRECT_REV = 3;
const SUBSCRIBER_DIRECT_UPDATES = 4;
const SUBSCRIBER_DIRECT_LATEST = 5;
const SUBSCRIBER_ASYNC = 2;
const SUBSCRIBER_ASYNC_ONLINE = 3;
const SUBSCRIBER_ASYNC_ONLINE_LATEST = 3;
const SUBSCRIBER_SUBSCRIPTIONS_CHANGES = 6;

export const Locations = {
    feedSeq: (feed: Buffer) => encoders.tuple.pack([feed, FEED_SEQ]),
    feedLatest: (feed: Buffer) => encoders.tuple.pack([feed, FEED_LATEST]),
    feedStream: (feed: Buffer) => encoders.tuple.pack([feed, FEED_STREAM]),

    subscriber: {
        subscription: (subscriber: Buffer, feed: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_SUBSCRIPTIONS, feed]),
        subscriptionVersion: (subscriber: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_SUBSCRIPTIONS_VERSION]),

        direct: (subscriber: Buffer, feed: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_DIRECT, feed]),
        directAll: (subscriber: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_DIRECT]),
        directReverse: (subscriber: Buffer, feed: Buffer) => encoders.tuple.pack([feed, SUBSCRIBER_DIRECT_REV, subscriber]),
        directReverseAll: (feed: Buffer) => encoders.tuple.pack([feed, SUBSCRIBER_DIRECT_REV]),
        directUpdates: (subscriber: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_DIRECT_UPDATES]),
        directLatest: (feed: Buffer) => encoders.tuple.pack([SUBSCRIBER_DIRECT_LATEST, feed]), // Change location?

        async: (subscriber: Buffer, feed: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_ASYNC, feed]),
        asyncAll: (subscriber: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_ASYNC]),
        asyncOnline: (feed: Buffer) => encoders.tuple.pack([feed, SUBSCRIBER_ASYNC_ONLINE]),
        asyncOnlineLatest: (subscriber: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_ASYNC_ONLINE_LATEST]),

        subscriptionChanges: (subscriber: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_SUBSCRIPTIONS_CHANGES])
    }
};