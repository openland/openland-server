import { encoders } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import {
    UpdateChatRead,
    UpdateProfileChanged,
} from 'openland-module-db/store';

export type FeedReference = { type: 'common', uid: number };

//
// Common Events
//

const CommonEvents = [
    UpdateChatRead,
    UpdateProfileChanged,
];

export type CommonEvent = ReturnType<(typeof CommonEvents[number])['create']>;

export function commonEventCollapseKey(src: CommonEvent): string | null {
    if (src.type === 'updateChatRead') {
        return 'read-' + src.cid;
    } else if (src.type === 'updateProfileChanged') {
        return 'profile-' + src.uid;
    }
    return null;
}

export function commonEventSerialize(src: CommonEvent) {
    return Buffer.from(JSON.stringify(Store.eventFactory.encode(src)), 'utf-8');
}
export function commonEventParse(src: Buffer): CommonEvent | null {
    let event = Store.eventFactory.decode(src.toString('utf-8'));
    for (let e of CommonEvents) {
        if (event.type === e.type) {
            return event as CommonEvent;
        }
    }
    return null;
}

//
// Handler
//

export type Event = CommonEvent;

export type UserSubscriptionHandlerEvent =
    | { type: 'started', seq: number, state: string }
    | { type: 'update', seq: number, feed: FeedReference, pts: number, event: Event }
    | { type: 'checkpoint', seq: number, state: string }
    | { type: 'closed' };

//
// Packing
//

export function packFeedEvent(feed: FeedReference, event: Buffer) {
    if (feed.type === 'common') {
        return encoders.tuple.pack([0, feed.uid, event]);
    }
    throw Error('Unknown feed type');
}

export function unpackFeedEvent(src: Buffer): { feed: FeedReference, event: Event } {
    let tuple = encoders.tuple.unpack(src);
    if (tuple[0] === 0) {
        let uid = tuple[1] as number;
        if (typeof uid !== 'number') {
            throw Error('Invalid event');
        }
        let event = tuple[2] as Buffer;
        if (!Buffer.isBuffer(event)) {
            throw Error('Invalid event');
        }
        let parsed = commonEventParse(event);
        if (!parsed) {
            throw Error('Invalid event');
        }
        return { feed: { type: 'common', uid }, event: parsed };
    }
    throw Error('Unknown feed type');
}