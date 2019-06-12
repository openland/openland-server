import { updateReader } from '../../openland-module-workers/updateReader';
import { FDB } from '../../openland-module-db/FDB';
import { Context } from '@openland/context';
import { inTx } from '../../foundation-orm/inTx';
import { createLogger } from '@openland/log';
import request, { Response } from 'request';
import { randomKey } from '../../openland-utils/random';

const log = createLogger('amplitude-batch-indexer');

const API_KEY = 'afbda859ebe1726f971f96a82665399e';

const mapEvent = (body: any) => {
    let event = body as { id: string, name: string, args: any, uid?: number, tid?: string, did: string, platform: 'Android' | 'iOS' | 'WEB', isProd: boolean, time: number };

    // Amplitude doc says: user_id Must have a minimum length of 5 characters.
    let userId = event.uid ? '00000' + event.uid : 'anon ' + randomKey();
    let deviceId = event.did ? '00000' + event.did : undefined;

    return {
        user_id: userId,
        device_id: deviceId,
        event_type: event.name,
        event_properties: event.args,
        insert_id: event.id,
        platform: event.platform,
        os_name: event.platform,
        time: event.time
    };
};

const addUserProps = async (ctx: Context, event: any) => {
    let userProperties: any = {};

    if (event.user_id) {
        let profile = await FDB.UserProfile.findById(ctx, event.user_id);
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

            userProperties.cohort_day = day;
            userProperties.cohort_week = week;
            userProperties.cohort_month = month;
            userProperties.cohort_year = year;

            let userMessagingState = await FDB.UserMessagingState.findById(ctx, profile.id);

            if (userMessagingState) {
                userProperties.messages_sent = (await FDB.UserMessagesSentCounter.byId(profile.id).get(ctx));
                userProperties.messages_received = (await FDB.UserMessagesReceivedCounter.byId(profile.id).get(ctx));
                userProperties.chats_count = (await FDB.UserMessagesChatsCounter.byId(profile.id).get(ctx));
                userProperties.direct_chats_count = (await FDB.UserMessagesDirectChatsCounter.byId(profile.id).get(ctx));
            }
        }
    }

    event.user_properties = userProperties;

    return event;
};

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
        await inTx(parent, async (ctx) => {
            let eventsProd = await Promise.all(items.filter(i => i.body.isProd === true).map(i => addUserProps(ctx, mapEvent(i.body))));
            // let eventsTest = await Promise.all(items.filter(i => i.body.isProd === false).map(i => addUserProps(ctx, mapEvent(i.body))));

            log.debug(ctx, 'prod events length: ', eventsProd.length);
            // log.debug(ctx, 'test events length: ', eventsTest.length);
            if (eventsProd.length > 0) {
                await saveEvents(ctx, eventsProd);
            }
        });
    });
}