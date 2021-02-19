import {
    UpdateChatDraftUpdated,
    UpdateDialogListSettingsChanged,
    UpdateFeedItemDeleted,
    UpdateFeedItemReceived,
    UpdateFeedItemUpdated,
    UpdateRoomChanged,
    UpdateSettingsChanged,
} from './../openland-module-db/store';
import { encoders } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import {
    UpdateChatRead,
    UpdateProfileChanged,
    UpdateChatMessage,
    UpdateChatMessageUpdated,
    UpdateChatMessageDeleted
} from 'openland-module-db/store';

export type FeedReference =
    | { type: 'common', uid: number }
    | { type: 'chat', cid: number }
    | { type: 'chat-private', cid: number, uid: number }
    | { type: 'feed-topic', tid: number };

//
// Common Events
//

const CommonEvents = [
    UpdateChatRead,
    UpdateChatDraftUpdated,
    UpdateProfileChanged,
    UpdateSettingsChanged,
    UpdateDialogListSettingsChanged,
    UpdateRoomChanged
];

export type CommonEvent = ReturnType<(typeof CommonEvents[number])['create']>;

export function commonEventCollapseKey(src: CommonEvent): string | null {
    if (src.type === 'updateChatRead') {
        return 'read-' + src.cid;
    } else if (src.type === 'updateProfileChanged') {
        return 'profile-' + src.uid;
    } else if (src.type === 'updateChatDraftUpdated') {
        return 'draft-' + src.cid;
    } else if (src.type === 'updateSettingsChanged') {
        return 'settings';
    }
    return null;
}

export function commonEventSerialize(src: CommonEvent) {
    return Buffer.from(JSON.stringify(Store.eventFactory.encode(src)), 'utf-8');
}
export function commonEventParse(src: Buffer): CommonEvent | null {
    let event = Store.eventFactory.decode(JSON.parse(src.toString('utf-8')));
    for (let e of CommonEvents) {
        if (event.type === e.type) {
            return event as CommonEvent;
        }
    }
    return null;
}

//
// Chat Events
//

const ChatEvents = [
    UpdateChatMessage,
    UpdateChatMessageUpdated,
    UpdateChatMessageDeleted,
    UpdateRoomChanged,
    UpdateProfileChanged
];

export type ChatEvent = ReturnType<(typeof ChatEvents[number])['create']>;

export function chatEventCollapseKey(src: ChatEvent): string | null {

    // All updates have same collapse key
    if (src.type === 'updateChatMessage') {
        return 'message-' + src.mid;
    } else if (src.type === 'updateChatMessageDeleted') {
        return 'message-' + src.mid;
    } else if (src.type === 'updateChatMessageUpdated') {
        return 'message-' + src.mid;
    }
    return null;
}

export function chatEventSerialize(src: ChatEvent) {
    return Buffer.from(JSON.stringify(Store.eventFactory.encode(src)), 'utf-8');
}
export function chatEventParse(src: Buffer): ChatEvent | null {
    let event = Store.eventFactory.decode(JSON.parse(src.toString('utf-8')));
    for (let e of ChatEvents) {
        if (event.type === e.type) {
            return event as ChatEvent;
        }
    }
    return null;
}

//
// Feed Events
//

const FeedEvents = [
    UpdateFeedItemReceived,
    UpdateFeedItemUpdated,
    UpdateFeedItemDeleted
];

export type FeedEvent = ReturnType<(typeof FeedEvents[number]['create'])>;

export function feedEventCollapseKey(src: FeedEvent): string | null {
    return null;
}

export function feedEventSerialize(src: FeedEvent) {
    return Buffer.from(JSON.stringify(Store.eventFactory.encode(src)), 'utf-8');
}
export function feedEventParse(src: Buffer): FeedEvent | null {
    let event = Store.eventFactory.decode(JSON.parse(src.toString('utf-8')));
    for (let e of FeedEvents) {
        if (event.type === e.type) {
            return event as FeedEvent;
        }
    }
    return null;
}

//
// Handler
//

export type Event = CommonEvent | ChatEvent | FeedEvent;

export type UserSubscriptionHandlerEvent =
    | { type: 'started', seq: number, state: string }
    | { type: 'update', seq: number, feed: FeedReference, pts: number, state: string, event: Event }
    | { type: 'update-ephemeral', seq: number, feed: FeedReference, event: Event }
    | { type: 'closed' };

//
// Packing
//

export function packFeedEvent(feed: FeedReference, event: Buffer) {
    if (feed.type === 'common') {
        return encoders.tuple.pack([0, feed.uid, event]);
    } else if (feed.type === 'chat') {
        return encoders.tuple.pack([1, feed.cid, event]);
    } else if (feed.type === 'chat-private') {
        return encoders.tuple.pack([2, feed.cid, feed.uid, event]);
    } else if (feed.type === 'feed-topic') {
        return encoders.tuple.pack([3, feed.tid, event]);
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
    } else if (tuple[0] === 1) {
        let cid = tuple[1] as number;
        if (typeof cid !== 'number') {
            throw Error('Invalid event');
        }
        let event = tuple[2] as Buffer;
        if (!Buffer.isBuffer(event)) {
            throw Error('Invalid event');
        }
        let parsed = chatEventParse(event);
        if (!parsed) {
            throw Error('Invalid event');
        }
        return { feed: { type: 'chat', cid }, event: parsed };
    } else if (tuple[0] === 2) {
        let cid = tuple[1] as number;
        let uid = tuple[2] as number;
        if (typeof cid !== 'number') {
            throw Error('Invalid event');
        }
        if (typeof uid !== 'number') {
            throw Error('Invalid event');
        }
        let event = tuple[3] as Buffer;
        if (!Buffer.isBuffer(event)) {
            throw Error('Invalid event');
        }
        let parsed = chatEventParse(event);
        if (!parsed) {
            throw Error('Invalid event');
        }
        return { feed: { type: 'chat-private', cid, uid }, event: parsed };
    } else if (tuple[0] === 3) {
        let tid = tuple[1] as number;
        if (typeof tid !== 'number') {
            throw Error('Invalid event');
        }
        let event = tuple[2] as Buffer;
        if (!Buffer.isBuffer(event)) {
            throw Error('Invalid event');
        }
        let parsed = feedEventParse(event);
        if (!parsed) {
            throw Error('Invalid event');
        }
        return { feed: { type: 'feed-topic', tid }, event: parsed };
    }
    throw Error('Unknown feed type');
}