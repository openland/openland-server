import { CallContext } from 'openland-server/api/utils/CallContext';
import { ConversationUserEvents } from 'openland-server/tables/ConversationUserEvents';

export default {
    /* 
     * Dialog Update Containers
     */
    DialogUpdateContainer: {
        __resolveType(obj: ConversationUserEvents | ConversationUserEvents[]) {
            if (Array.isArray(obj)) {
                if (obj.length < 2) {
                    throw Error('Unable to resolve batch update for less than two updates!');
                }
                return 'DialogUpdateBatch';
            } else {
                return 'DialogUpdateSingle';
            }
        }
    },
    DialogUpdateBatch: {
        updates: (src: ConversationUserEvents[]) => src,
        fromSeq: (src: ConversationUserEvents[]) => src[0].seq,
        seq: (src: ConversationUserEvents[]) => src[src.length - 1].seq,
        state: (src: ConversationUserEvents[]) => '00' + src[src.length - 1].seq
    },
    DialogUpdateSingle: {
        seq: (src: ConversationUserEvents) => src.seq,
        state: (src: ConversationUserEvents) => '00' + src.seq,
        update: (src: ConversationUserEvents) => src,
    },
    /*
     * Dialog Updates
     */
    DialogUpdate: {
        __resolveType(obj: ConversationUserEvents) {
            if (obj.eventType === 'new_message') {
                return 'DialogMessageReceived';
            } else if (obj.eventType === 'DialogMessageUpdated') {
                return 'DialogMessageUpdated';
            } else if (obj.eventType === 'delete_message') {
                return 'DialogMessageDeleted';
            } else if (obj.eventType === 'conversation_read') {
                return 'DialogMessageRead';
            } else if (obj.eventType === 'title_change') {
                return 'DialogTitleUpdated';
            } else if (obj.eventType === 'chat_update') {
                return 'DialogPhotoUpdated';
            }
            throw Error('Unknown dialog update type: ' + obj.eventType);
        }
    },
    DialogMessageReceived: {

    },
    DialogMessageUpdated: {

    },
    DialogMessageDeleted: {

    },
    DialogMessageRead: {

    },
    DialogTitleUpdated: {

    },
    DialogPhotoUpdated: {

    },

    /*
     * Subscription
     */
    Subscription: {
        dialogUpdates: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { fromState?: string }, context: CallContext) {
                //
            }
        },
    }
};