import { EventSerializer } from './receiver/EventSerializer';
import { Store } from 'openland-module-db/FDB';
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

export const Serializer: EventSerializer<Event> = {
    parseEvent(src: Buffer): Event {
        let json = src.toString('utf-8');
        return Store.eventFactory.decode(JSON.parse(json)) as Event;
    },
    serializeEvent(event: Event) {
        return Buffer.from(JSON.stringify(Store.eventFactory.encode(event)), 'utf-8');
    }
};