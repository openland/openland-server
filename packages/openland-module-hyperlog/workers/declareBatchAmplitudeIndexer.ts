import { HyperLog } from './../../openland-module-db/store';
import { inTx } from '@openland/foundationdb';
import { updateReader } from '../../openland-module-workers/updateReader';
import { Store } from '../../openland-module-db/FDB';
import { Context } from '@openland/context';
import { createLogger } from '@openland/log';
import request, { Response } from 'request';
import { randomKey } from '../../openland-utils/random';
import { delay } from '../../openland-utils/timer';
import { InternalTrackEvent } from '../Log.resolver';

const log = createLogger('amplitude-batch-indexer');

const API_KEY_PROD = '74a224d67ecce6c3f53c3f2b5f162368';
const API_KEY_TEST = 'a84549e7390473dbc3abbfe151462f82';

export interface AmplitudeEvent {
    user_id?: string;
    device_id?: string;
    event_type: string;
    event_properties?: any;
    insert_id: string;
    platform: string;
    os_name: string;
    device_model: string;
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
    direct_2way_chats_count: number;
}

function toAmplitudeEvent(event: InternalTrackEvent, userProps?: AmplitudeUserProps): AmplitudeEvent {
    // Amplitude doc says: user_id Must have a minimum length of 5 characters.
    let userId = event.uid ? '00000' + event.uid : undefined;
    let deviceId = event.did ? '00000' + event.did : undefined;
    if (deviceId === '00000server') {
        deviceId = 'server ' + randomKey();
    }

    let eventProperties: any =  undefined;
    if (typeof event.args === 'object' && !Array.isArray(event.args)) {
        eventProperties = event.args;
    }

    return {
        user_id: userId,
        device_id: deviceId,
        event_type: event.name.trim().length > 0 ? event.name : 'unknown',
        event_properties: eventProperties,
        insert_id: event.id,
        platform: event.platform,
        os_name: event.os || 'unknown',
        device_model: event.deviceModel || 'unknown',
        time: event.time,
        user_properties: userProps
    };
}

async function fetchUserProps(ctx: Context, uid: number): Promise<AmplitudeUserProps | null> {
    let profile = await Store.UserProfile.findById(ctx, uid);
    if (profile) {
        let date = new Date(profile.metadata.createdAt);

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

            messages_sent: (await Store.UserMessagesSentCounter.byId(profile.id).get(ctx)),
            messages_received: (await Store.UserMessagesReceivedCounter.byId(profile.id).get(ctx)),
            chats_count: (await Store.UserMessagesChatsCounter.byId(profile.id).get(ctx)),
            direct_chats_count: (await Store.UserMessagesDirectChatsCounter.byId(profile.id).get(ctx)),
            direct_2way_chats_count: (await Store.User2WayDirectChatsCounter.byId(profile.id).get(ctx)),
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

const saveEvents = async (ctx: Context, events: any[], key: string) => {
    await new Promise((resolve, reject) => {
        request.post({
            url: 'https://api.amplitude.com/batch',
            json: {
                api_key: key,
                events
            },
        }, function (err: any, response: Response, body: any) {
            if (err) {
                log.warn(ctx, 'Amplitude error: ', err);
                reject(err);
            } else if (response.statusCode !== 200) {
                log.warn(ctx, 'Amplitude status ', response.statusCode, response.body, JSON.stringify(events));
                reject(Error('Amplitude status ' + response.statusCode + ': "' + body + '"'));
            } else {
                log.log(ctx, 'Export successful...', response.statusCode, response.body);
                resolve();
            }
        });
    });
};

export function declareBatchAmplitudeIndexer() {
    updateReader('amplitude-batch-indexer', 9, Store.HyperLog.userEvents.stream({ batchSize: 1000 }), async (items, first, parent) => {
        let exportedCount = await inTx(parent, async (ctx) => {
            let exCount = 0;
            let eventsProd = await convertToAmplitudeEvents(ctx, items.filter(i => i.body.isProd === true));
            log.debug(ctx, 'prod events length: ', eventsProd.length);
            if (eventsProd.length > 0) {
                await saveEvents(ctx, eventsProd, API_KEY_PROD);
                exCount += eventsProd.length;
            }

            let eventsTest = await convertToAmplitudeEvents(ctx, items.filter(i => i.body.isProd === false));
            log.debug(ctx, 'test events length: ', eventsTest.length);
            if (eventsTest.length > 0) {
                await saveEvents(ctx, eventsTest, API_KEY_TEST);
                exCount += eventsTest.length;
            }
            return exCount;
        });
        if (exportedCount > 500) {
            await delay(5000);
        }
    });
}