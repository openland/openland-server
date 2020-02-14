import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import TypingTypeRoot = GQLRoots.TypingTypeRoot;

export interface TypingEvent {
    forUserId: number;
    userId: number;
    conversationId: number;
    type: TypingTypeRoot;
    cancel: boolean;
}
