import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import TypingTypeRoot = GQLRoots.TypingTypeRoot;

export interface TypingEvent {
    uid: number;
    cid: number;
    type: TypingTypeRoot;
}
