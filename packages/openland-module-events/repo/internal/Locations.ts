import { VersionstampRef, Versionstamp } from '@openland/foundationdb-tuple';
import { encoders, TupleItem, TupleItemExtended } from '@openland/foundationdb';

//
// Feed
//
// Event stream
const FEED_STREAM = 0;
const FEED_STREAM_NORMALIZED = 0;
const FEED_STREAM_VT = 1;
const FEED_STREAM_SEQ = 2;
// VT and Seq
const FEED_LATEST = 1;
const FEED_SEQ = 2;
// Event collapsing map
const FEED_COLLAPSE = 3;
// Direct members
const FEED_DIRECT = 4;
// Async members
const FEED_ASYNC_ONLINE = 6;
// Feed counters
const FEED_COUNTER = 7;
const FEED_COUNTER_DIRECT = 8;
const FEED_COUNTER_ASYNC = 9;

//
// Subscriber
//
const SUBSCRIBER_SUBSCRIPTIONS = 0;
const SUBSCRIBER_VT = 5;
const SUBSCRIBER_DIRECT = 1;
const SUBSCRIBER_DIRECT_UPDATES = 4;
const SUBSCRIBER_ASYNC = 2;
const SUBSCRIBER_SUBSCRIPTIONS_CHANGES = 6;

const STATS = 0;
const STATS_FEEDS = 1;
const STATS_SUBSCRIBERS = 2;
const STATS_SUBSCRIPTIONS = 3;

type TupleType = TupleItem[];
type TupleTypeEx = TupleItemExtended[];

export const Locations = {
    feed: {
        seq: (feed: Buffer): TupleType => [feed, FEED_SEQ],
        latest: (feed: Buffer): TupleType => [feed, FEED_LATEST],

        stream: (feed: Buffer): TupleType => [feed, FEED_STREAM, FEED_STREAM_NORMALIZED],
        streamItem: (feed: Buffer, vt: Versionstamp): TupleType => [feed, FEED_STREAM, FEED_STREAM_NORMALIZED, vt],
        streamItemWrite: (feed: Buffer, vt: VersionstampRef): TupleTypeEx => [feed, FEED_STREAM, FEED_STREAM_NORMALIZED, vt],

        streamVt: (feed: Buffer): TupleType => [feed, FEED_STREAM, FEED_STREAM_VT],
        streamVtItem: (feed: Buffer, vt: Versionstamp): TupleType => [feed, FEED_STREAM, FEED_STREAM_VT, vt],
        streamVtItemWrite: (feed: Buffer, vt: VersionstampRef): TupleTypeEx => [feed, FEED_STREAM, FEED_STREAM_VT, vt],

        streamSeq: (feed: Buffer): TupleType => [feed, FEED_STREAM, FEED_STREAM_SEQ],
        streamSeqItem: (feed: Buffer, seq: number): TupleType => [feed, FEED_STREAM, FEED_STREAM_SEQ, seq],

        collapsed: (feed: Buffer, key: string): TupleType => [feed, FEED_COLLAPSE, key],

        direct: (feed: Buffer, subscriber: Buffer): TupleType => [feed, FEED_DIRECT, subscriber],
        directAll: (feed: Buffer): TupleType => [feed, FEED_DIRECT],

        asyncOnlineAll: (feed: Buffer): TupleType => [feed, FEED_ASYNC_ONLINE],
        asyncOnlineAfter: (feed: Buffer, time: number): TupleType => [feed, FEED_ASYNC_ONLINE, time],
        asyncOnlineItem: (feed: Buffer, subscriber: Buffer, expires: number): TupleType => [feed, FEED_ASYNC_ONLINE, expires, subscriber],

        counterTotal: (feed: Buffer) => encoders.tuple.pack([feed, FEED_COUNTER]),
        counterDirect: (feed: Buffer) => encoders.tuple.pack([feed, FEED_COUNTER_DIRECT]),
        counterAsync: (feed: Buffer) => encoders.tuple.pack([feed, FEED_COUNTER_ASYNC]),
    },

    subscriber: {

        subscription: (subscriber: Buffer, feed: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_SUBSCRIPTIONS, feed]),
        subscriptionDescriptor: (subscriber: Buffer, feed: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_SUBSCRIPTIONS, feed, 0]),
        subscriptionStart: (subscriber: Buffer, feed: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_SUBSCRIPTIONS, feed, 1]),
        subscriptionStop: (subscriber: Buffer, feed: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_SUBSCRIPTIONS, feed, 2]),
        subscriptionAll: (subscriber: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_SUBSCRIPTIONS]),

        subscriptionVt: (subscriber: Buffer) => encoders.tuple.pack([subscriber, SUBSCRIBER_VT]),

        direct: (subscriber: Buffer, feed: Buffer): TupleType => [subscriber, SUBSCRIBER_DIRECT, feed],
        directAll: (subscriber: Buffer): TupleType => [subscriber, SUBSCRIBER_DIRECT],
        directUpdatesAll: (subscriber: Buffer): TupleType => [subscriber, SUBSCRIBER_DIRECT_UPDATES],
        directUpdatesRead: (subscriber: Buffer, vt: Versionstamp): TupleType => [subscriber, SUBSCRIBER_DIRECT_UPDATES, vt],
        directUpdatesWrite: (subscriber: Buffer, vt: VersionstampRef) => [subscriber, SUBSCRIBER_DIRECT_UPDATES, vt],

        async: (subscriber: Buffer, feed: Buffer): TupleType => [subscriber, SUBSCRIBER_ASYNC, feed],
        asyncAll: (subscriber: Buffer): TupleType => [subscriber, SUBSCRIBER_ASYNC],

        subscriptionChanges: {
            all: (subscriber: Buffer): TupleType => [subscriber, SUBSCRIBER_SUBSCRIPTIONS_CHANGES],
            read: (subscriber: Buffer, vt: Versionstamp): TupleType => [subscriber, SUBSCRIBER_SUBSCRIPTIONS_CHANGES, vt],
            write: (subscriber: Buffer, vt: VersionstampRef): TupleTypeEx => [subscriber, SUBSCRIBER_SUBSCRIPTIONS_CHANGES, vt]
        }
    },

    stats: {
        feeds: encoders.tuple.pack([STATS, STATS_FEEDS]),
        subscribers: encoders.tuple.pack([STATS, STATS_SUBSCRIBERS]),
        subscriptions: encoders.tuple.pack([STATS, STATS_SUBSCRIPTIONS]),
    }
    }