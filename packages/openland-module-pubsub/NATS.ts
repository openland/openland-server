import { createLogger } from '@openland/log';
import { createNamedContext } from '@openland/context';
import { asyncRun } from 'openland-utils/timer';
import { Subscription } from 'ts-nats';
import { Modules } from 'openland-modules/Modules';

export type NatsCallback = (e: { data: any, replyTo?: string }) => void;
const ctx = createNamedContext('eventbus');
const logger = createLogger('nats');
export interface NatsSubscription {
    cancel(): void;
}

class NatsImpl {

    subscribe = (topic: string, callback: (e: { data: any | undefined, reply?: string }) => void): NatsSubscription => {
        let canceled = false;
        let raw: Subscription | undefined = undefined;

        asyncRun(async () => {
            let subs = await Modules.NATS.subscribe(topic, (e, msg) => {
                if (e) {
                    logger.warn(ctx, e);
                    return;
                }
                if (canceled) {
                    return;
                }
                let data = msg.data;
                let reply = msg.reply;
                callback({ data, reply });
            });
            if (canceled) {
                subs.unsubscribe();
            } else {
                raw = subs;
            }
        });

        return {
            cancel: () => {
                canceled = true;
                if (raw) {
                    raw.unsubscribe();
                }
            }
        };
    }

    post = (topic: string, data: any, reply?: string) => {
        Modules.NATS.publish(topic, data, reply);
    }

    request = async (topic: string, timeout: number, data?: any) => {
        let res = await Modules.NATS.request(topic, timeout, data);
        return res.data;
    }
}

export const NATS = new NatsImpl;