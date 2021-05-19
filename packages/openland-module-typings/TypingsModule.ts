import { Modules } from 'openland-modules/Modules';
import { EventBusSubcription, EventBus } from 'openland-module-pubsub/EventBus';
import { createIterator } from 'openland-utils/asyncIterator';
import { TypingEvent } from './TypingEvent';
import { injectable } from 'inversify';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import TypingTypeRoot = GQLRoots.TypingTypeRoot;
import { Context } from '@openland/context';

@injectable()
export class TypingsModule {

    start = async () => {
        // Nothing to do
    }

    public async setTyping(parent: Context, uid: number, cid: number, type: TypingTypeRoot) {
        let privateUid = await Modules.Messaging.room.isPrivate(parent, cid, uid);
        if (privateUid !== false) {
            EventBus.publish('ephemeral', 'user.' + privateUid + '.typings', { cid, uid, type });
        } else {
            EventBus.publish('ephemeral', 'group.' + cid + '.typings', { cid, uid, type });
        }
    }

    public createTypingStream(forUser: number) {
        let sub: EventBusSubcription | undefined;
        let iterator = createIterator<TypingEvent>(() => sub ? sub.cancel() : {});
        sub = EventBus.subscribe('ephemeral', 'user.' + forUser + '.typings', (ev) => {
            let cid = ev.cid as number;
            let uid = ev.uid as number;
            let type = ev.type as TypingTypeRoot;
            if (uid === forUser) {
                return;
            }
            iterator.push({ cid, uid, type });
        });

        return iterator;
    }
}
