import { Modules } from 'openland-modules/Modules';
import { EventBusSubcription, EventBus } from 'openland-module-pubsub/EventBus';
import { createIterator } from 'openland-utils/asyncIterator';
import { TypingEvent } from './TypingEvent';
import { injectable } from 'inversify';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import TypingTypeRoot = GQLRoots.TypingTypeRoot;
import { Context } from '@openland/context';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { declareRemoteQueryExecutor } from 'openland-module-api/remoteExecutor';

@injectable()
export class TypingsModule {

    start = async () => {
        // Nothing to do
        if (serverRoleEnabled('events')) {
            declareRemoteQueryExecutor('events');
        }
    }

    public async setTyping(parent: Context, uid: number, cid: number, type: TypingTypeRoot) {
        let privateUid = await Modules.Messaging.room.isPrivate(parent, cid, uid);
        if (privateUid !== false) {
            EventBus.publish('user.' + privateUid + '.typings', { cid, uid, type });
        } else {
            EventBus.publish('group.' + cid + '.typings', { cid, uid, type });
        }
    }

    public createTypingStream(forUser: number) {
        let sub: EventBusSubcription | undefined;
        let iterator = createIterator<TypingEvent>(() => sub ? sub.cancel() : {});
        sub = EventBus.subscribe('user.' + forUser + '.typings', (ev) => {
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
