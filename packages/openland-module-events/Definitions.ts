import { Store } from 'openland-module-db/FDB';
import {
    UpdateChatRead,
    UpdateProfileChanged,
    UpdateChatAccessChanged
} from 'openland-module-db/store';

//
// Common Events
//

const CommonEvents = [
    UpdateChatRead,
    UpdateProfileChanged,
    UpdateChatAccessChanged
];

export type CommonEvent = ReturnType<(typeof CommonEvents[number])['create']>;

export function commonEventCollapseKey(src: CommonEvent): string | null {
    if (src.type === 'updateChatRead') {
        return 'read-' + src.cid;
    } else if (src.type === 'updateProfileChanged') {
        return 'profile-' + src.uid;
    } else if (src.type === 'updateChatAccessChanged') {
        return 'access-' + src.cid;
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