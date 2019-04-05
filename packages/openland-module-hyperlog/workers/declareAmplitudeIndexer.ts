import { updateReader } from 'openland-module-workers/updateReader';
import { FDB } from 'openland-module-db/FDB';
import { createEmptyContext } from 'openland-utils/Context';
import request, { Response } from 'request';

const AMPLITUDE_TEST_KEY = '158a2c0e7619751c92cdf1943462a44e';

export function declareAmplitudeIndexer() {
    if (process.env.AMPLITUDE_KEY) {
        let apiKey = process.env.AMPLITUDE_KEY;
        updateReader('amplitude-indexer', 2, FDB.HyperLog.createUserEventsStream(createEmptyContext(), 50), async (items) => {
            const saveEvents = async (events: any[], isProd: boolean) => {
                await new Promise((resolve, reject) => {
                    request.post({
                        url: 'https://api.amplitude.com/httpapi',
                        form: {
                            api_key: isProd ? apiKey : AMPLITUDE_TEST_KEY,
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

            const mapEvent = (body: any) => {
                let event = body as { id: string, name: string, args: any, uid?: number, tid?: string, did: string, platform: 'Android'|'iOS'|'WEB', isProd: boolean };
                return {
                    user_id: event.uid,
                    device_id: event.did,
                    event_type: event.name,
                    event_properties: event.args,
                    insert_id: event.id,
                    platform: event.platform
                };
            };

            let eventsProd = items.filter(i => i.body.isProd === true).map(mapEvent);
            let eventsTest = items.filter(i => i.body.isProd === false).map(mapEvent);

            await saveEvents(eventsProd, true);
            await saveEvents(eventsTest, false);
        });
    }
}