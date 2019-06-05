import { updateReader } from 'openland-module-workers/updateReader';
import { FDB } from 'openland-module-db/FDB';
import request, { Response } from 'request';
import { inTx } from '../../foundation-orm/inTx';
import { EmptyContext } from '@openland/context';

const AMPLITUDE_TEST_KEY = '158a2c0e7619751c92cdf1943462a44e';
const AMPLITUDE_KEY = process.env.AMPLITUDE_KEY;

const saveEvents = async (events: any[], isProd: boolean) => {
    await new Promise((resolve, reject) => {
        request.post({
            url: 'https://api.amplitude.com/httpapi',
            form: {
                api_key: isProd ? AMPLITUDE_KEY : AMPLITUDE_TEST_KEY,
                event: JSON.stringify(events)
            }
        }, function (err: any, response: Response, body: any) {
            if (err) {
                console.warn(err);
                reject(err);
            } else if (response.statusCode !== 200) {
                console.warn(response);
                reject(Error('Amplitude status ' + response.statusCode + ': "' + body + '"'));
            } else {
                console.log('Export successful...');
                resolve();
            }
        });
    });
};

export function declareAmplitudeIndexer() {
    if (process.env.AMPLITUDE_KEY) {
        updateReader('amplitude-indexer', 2, FDB.HyperLog.createUserEventsStream(EmptyContext, 50), async (items) => {
            await inTx(EmptyContext, async (ctx) => {
                const mapEvent = (body: any) => {
                    let event = body as { id: string, name: string, args: any, uid?: number, tid?: string, did: string, platform: 'Android' | 'iOS' | 'WEB', isProd: boolean, time: number };
                    return {
                        user_id: event.uid,
                        device_id: event.did,
                        event_type: event.name,
                        event_properties: event.args,
                        insert_id: event.id,
                        platform: event.platform,
                        os_name: event.platform,
                        time: event.time
                    };
                };

                const addUserProps = async (event: any) => {
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
                                userProperties.messages_sent = (await FDB.UserMessagesSentCounter.findById(ctx, profile.id)).get(ctx) || 0;
                                userProperties.messages_received = (await FDB.UserMessagesReceivedCounter.findById(ctx, profile.id)).get(ctx) || 0;
                                userProperties.chats_count = (await FDB.UserMessagesChatsCounter.findById(ctx, profile.id)).get(ctx) || 0;
                                userProperties.direct_chats_count = (await FDB.UserMessagesDirectChatsCounter.findById(ctx, profile.id)).get(ctx) || 0;
                            }
                        }
                    }

                    event.user_properties = userProperties;

                    return event;
                };

                let eventsProd = await Promise.all(items.filter(i => i.body.isProd === true).map(i => addUserProps(mapEvent(i.body))));
                let eventsTest = await Promise.all(items.filter(i => i.body.isProd === false).map(i => addUserProps(mapEvent(i.body))));

                await saveEvents(eventsProd, true);
                await saveEvents(eventsTest, false);
            });
        });
    }
}