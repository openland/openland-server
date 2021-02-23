import {
    atomicInt,
    boolean,
    entity,
    enumString, event,
    field,
    integer,
    optional,
    primaryKey,
    rangeIndex,
    string
} from '@openland/foundationdb-compiler';
import { eventStore } from '@openland/foundationdb-compiler/lib/builder';

export function voiceChatsStore() {
    entity('ConversationVoice', () => {
        primaryKey('id', integer());
        field('title', optional(string()));
        field('active', boolean());

        rangeIndex('active', ['createdAt']).withCondition(a => a.active);
    });

    entity('VoiceChatParticipant', () => {
        primaryKey('cid', integer());
        primaryKey('uid', integer());
        field('tid', optional(string()));
        field('status', enumString(
            // In-chat status
            'listener',
            'speaker',
            'admin',

            // Chat left status
            'left',
            'kicked'
        ));
        field('handRaised', boolean());
        field('promotedBy', optional(integer()));

        rangeIndex('chat', ['cid', 'updatedAt'])
            .withCondition(a => a.status !== 'left' && a.status !== 'kicked');
        rangeIndex('handRaised', ['cid', 'updatedAt'])
            .withCondition(a => a.status !== 'left' && a.status !== 'kicked' && a.handRaised);
        rangeIndex('speakers', ['cid', 'updatedAt'])
            .withCondition(a => a.status !== 'left' && a.status !== 'kicked' && (a.status === 'speaker' || a.status === 'admin'));
        rangeIndex('listeners', ['cid', 'updatedAt'])
            .withCondition(a => a.status !== 'left' && a.status !== 'kicked' && a.status === 'listener');
    });
    atomicInt('VoiceChatParticipantCounter', () => {
        primaryKey('cid', integer());
        primaryKey('status', enumString(
            'listener',
            'speaker',
            'admin'
        ));
    });
    atomicInt('VoiceChatParticipantActive', () => {
        primaryKey('uid', integer());
    });

    //
    // Events
    //
    event('VoiceChatParticipantUpdatedEvent', () => {
        field('cid', integer());
        field('uid', integer());
    });
    event('VoiceChatUpdatedEvent', () => {
        field('cid', integer());
    });
    eventStore('VoiceChatEventsStore', () => {
        primaryKey('id', integer());
    });
}