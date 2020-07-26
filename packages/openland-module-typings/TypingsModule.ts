import { createIterator } from 'openland-utils/asyncIterator';
import { TypingEvent } from './TypingEvent';
import { PubsubSubcription, Pubsub } from 'openland-module-pubsub/pubsub';
import { injectable } from 'inversify';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import TypingTypeRoot = GQLRoots.TypingTypeRoot;
import { registerTypingsService } from './service/registerTypingsService';
import { broker } from 'openland-server/moleculer';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { asyncRun } from '../openland-mtproto3/utils';
import { createLogger } from '@openland/log';
import { createNamedContext } from '@openland/context';

const log = createLogger('typings');
const ctx = createNamedContext('typings');

@injectable()
export class TypingsModule {

    private xPubSub = new Pubsub<TypingEvent>();

    start = async () => {
        if (serverRoleEnabled('workers')) {
            registerTypingsService(this.xPubSub);
        }
    }

    public async setTyping(uid: number, conversationId: number, type: TypingTypeRoot) {
        try {
            asyncRun(async () => {
                // tslint:disable-next-line:no-floating-promises
                broker.call('typings.send', {
                    uid: uid,
                    cid: conversationId,
                    type: type
                });
            });
        } catch (e) {
            log.error(ctx, e);
        }
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
