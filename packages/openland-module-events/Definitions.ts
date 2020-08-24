import { Store } from 'openland-module-db/FDB';
import { encoders } from '@openland/foundationdb';
import {
    UpdateChatRead,
    UpdateChatMessage,
    UpdateChatMessageUpdated,
    UpdateChatMessageDeleted,
    UpdateChatGotAccess,
    UpdateChatLostAccess
} from 'openland-module-db/store';

//
// All available events 
//

export type Event =
    | UpdateChatRead
    | UpdateChatMessage
    | UpdateChatMessageUpdated
    | UpdateChatMessageDeleted
    | UpdateChatGotAccess
    | UpdateChatLostAccess
    ;

//
// Serialization
//

export function serializeEvent(event: Event) {
    return Buffer.from(JSON.stringify(Store.eventFactory.encode(event)), 'utf-8');
}

export function parseEvent(src: Buffer): Event {
    let json = src.toString('utf-8');
    return Store.eventFactory.decode(JSON.parse(json)) as Event;
}

//
// Repeat Key Resolving
//

const REPEAT_READ = 0;
const REPEAT_UPDATED = 1;
const REPEAT_ACCESS = 2;
export function resolveRepeatKey(event: Event): Buffer | undefined {
    if (event instanceof UpdateChatRead) {
        return encoders.tuple.pack([REPEAT_READ, event.cid]);
    } else if (event instanceof UpdateChatMessageUpdated) {
        return encoders.tuple.pack([REPEAT_UPDATED, event.cid, event.mid]);
    } else if (event instanceof UpdateChatGotAccess || event instanceof UpdateChatLostAccess) {
        return encoders.tuple.pack([REPEAT_ACCESS, event.cid]);
    }
    return undefined;
}