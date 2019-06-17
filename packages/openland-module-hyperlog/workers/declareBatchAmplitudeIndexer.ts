import { updateReader } from '../../openland-module-workers/updateReader';
import { FDB } from '../../openland-module-db/FDB';
import { Context } from '@openland/context';
import { inTx } from '../../foundation-orm/inTx';
import { createLogger } from '@openland/log';
import request, { Response } from 'request';
import { randomKey } from '../../openland-utils/random';
import { delay } from '../../openland-utils/timer';
import { HyperLog } from '../../openland-module-db/schema';

const log = createLogger('amplitude-batch-indexer');

const API_KEY = 'afbda859ebe1726f971f96a82665399e';

interface InternalEvent {
    id: string;
    name: string;
    args: any;
    uid?: number;
    tid?: string;
    did: string;
    platform: 'Android' | 'iOS' | 'WEB';
    isProd: boolean;
    time: number;
}
export interface AmplitudeEvent {
    user_id?: string;
    device_id?: string;
    event_type: string;
    event_properties?: any;
    insert_id: string;
    platform: string;
    os_name: string;
    time: number;
    user_properties?: AmplitudeUserProps;
}

interface AmplitudeUserProps {
    cohort_day: number;
    cohort_week: number;
    cohort_month: number;
    cohort_year: number;

    messages_sent: number;
    messages_received: number;
    chats_count: number;
    direct_chats_count: number;
}

function toAmplitudeEvent(event: InternalEvent, userProps?: AmplitudeUserProps): AmplitudeEvent {
    // Amplitude doc says: user_id Must have a minimum length of 5 characters.
    let userId = event.uid ? '00000' + event.uid : undefined;
    let deviceId = event.did ? '00000' + event.did : undefined;
    if (event.did === '00000server') {
        deviceId = 'server ' + randomKey();
    }

    return {
        user_id: userId,
        device_id: deviceId,
        event_type: event.name,
        event_properties: event.args,
        insert_id: event.id,
        platform: event.platform,
        os_name: event.platform,
        time: event.time,
        user_properties: userProps
    };
}

async function fetchUserProps(ctx: Context, uid: number): Promise<AmplitudeUserProps | null> {
    let profile = await FDB.UserProfile.findById(ctx, uid);
    if (profile) {
        let date = new Date(profile.createdAt);

        let start = new Date(date.getFullYear(), 0, 0);
        let diff = ((date as any) - (start as any)) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
        let oneDay = 1000 * 60 * 60 * 24;
        let day = Math.floor(diff / oneDay);

        let firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        let pastDaysOfYear = ((date as any) - (firstDayOfYear as any)) / 86400000;
        let week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

        let month = date.getUTCMonth() + 1;
        let year = date.getFullYear();

        return {
            cohort_day: day,
            cohort_week: week,
            cohort_month: month,
            cohort_year: year,

            messages_sent: (await FDB.UserMessagesSentCounter.byId(profile.id).get(ctx)),
            messages_received: (await FDB.UserMessagesReceivedCounter.byId(profile.id).get(ctx)),
            chats_count: (await FDB.UserMessagesChatsCounter.byId(profile.id).get(ctx)),
            direct_chats_count: (await FDB.UserMessagesDirectChatsCounter.byId(profile.id).get(ctx)),
        };
    }

    return null;
}

async function convertToAmplitudeEvents(ctx: Context, items: HyperLog[]) {
    let events: AmplitudeEvent[] = [];
    for (let item of items) {
        let body = item.body;
        let userProps = body.uid ? await fetchUserProps(ctx, body.uid) : undefined;
        events.push(toAmplitudeEvent(body, userProps || undefined));
    }
    return events;
}

const saveEvents = async (ctx: Context, events: any[]) => {
    await new Promise((resolve, reject) => {
        request.post({
            url: 'https://api.amplitude.com/batch',
            json: {
                api_key: API_KEY,
                events
            },
        }, function (err: any, response: Response, body: any) {
            if (err) {
                log.warn(ctx, 'Amplitude error: ', err);
                reject(err);
            } else if (response.statusCode !== 200) {
                log.warn(ctx, 'Amplitude status ', response.statusCode, response.body);
                reject(Error('Amplitude status ' + response.statusCode + ': "' + body + '"'));
            } else {
                log.warn(ctx, 'Export successful...', response.statusCode, response.body);
                resolve();
            }
        });
    });
};

export function declareBatchAmplitudeIndexer() {
    updateReader('amplitude-batch-indexer', 7, FDB.HyperLog.createUserEventsStream(1000), async (items, first, parent) => {
        let exportedCount = await inTx(parent, async (ctx) => {
            let exCount = 0;
            let eventsProd = await convertToAmplitudeEvents(ctx, items.filter(i => i.body.isProd === true));
            log.debug(ctx, 'prod events length: ', eventsProd.length);
            if (eventsProd.length > 0) {
                await saveEvents(ctx, eventsProd);
                exCount += eventsProd.length;
            }
            return exCount;
        });
        if (exportedCount > 500) {
            await delay(5000);
        }
    });
}