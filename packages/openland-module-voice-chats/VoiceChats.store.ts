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
        field('startedAt', optional(integer()));
        field('startedBy', optional(integer()));
        field('endedAt', optional(integer()));
        field('duration', optional(integer()));
        field('pinnedMessageId', optional(integer()));
        field('isPrivate', optional(boolean()));
        field('parentChat', optional(integer()));

        rangeIndex('active', ['createdAt']).withCondition(a => a.active && !a.isPrivate);
    });

    entity('VoiceChatParticipant', () => {
        primaryKey('cid', integer());
        primaryKey('uid', integer());
        field('tid', optional(string()));
        field('status', enumString(
            'joined',
            'left',
            'kicked',

            // Obsolete statuses
            // 'listener',
            // 'speaker',
            // 'admin'
        ));
        field('role', optional(enumString(
            'listener',
            'speaker',
            'admin'
        )));
        field('handRaised', boolean());
        field('promotedBy', optional(integer()));

        rangeIndex('chatAll', ['cid', 'updatedAt']);
        rangeIndex('chat', ['cid', 'updatedAt'])
            .withCondition(a => a.status === 'joined');
        rangeIndex('handRaised', ['cid', 'updatedAt'])
            .withCondition(a => a.status === 'joined' && !!a.handRaised);
        rangeIndex('speakers', ['cid', 'updatedAt'])
            .withCondition(a => a.status === 'joined' && (a.role === 'speaker' || a.role === 'admin'));
        rangeIndex('listeners', ['cid', 'updatedAt'])
            .withCondition(a => a.status === 'joined' && a.role === 'listener');
    });
    atomicInt('VoiceChatParticipantCounter', () => {
        primaryKey('cid', integer());
        primaryKey('role', enumString(
            'listener',
            'speaker',
            'admin',
            'handRaised'
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