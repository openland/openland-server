import { createIterator } from 'openland-utils/asyncIterator';
import { TypingEvent } from './TypingEvent';
import { PubsubSubcription, Pubsub } from 'openland-module-pubsub/pubsub';
import { injectable } from 'inversify';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import TypingTypeRoot = GQLRoots.TypingTypeRoot;
import { registerTypingsService } from './service/registerTypingsService';
import { broker } from 'openland-server/moleculer';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';

@injectable()
export class TypingsModule {

    private xPubSub = new Pubsub<TypingEvent>();

    start = async () => {
        if (serverRoleEnabled('workers')) {
            registerTypingsService(this.xPubSub);
        }
    }

    public async setTyping(uid: number, conversationId: number, type: TypingTypeRoot) {
        // tslint:disable-next-line:no-floating-promises
        broker.call('typings.send', {
            uid: uid,
            cid: conversationId,
            type: type
        });
    }

    public async createTypingStream(uid: number, conversationId?: number) {

        let sub: PubsubSubcription | undefined;

        let iterator = createIterator<TypingEvent>(() => sub ? sub.cancel() : {});

        sub = await this.xPubSub.subscribe(`TYPING_${uid}`, ev => {
            if (conversationId && ev.conversationId !== conversationId) {
                return;
            }

            iterator.push(ev);
        });

        return iterator;
    }
}
