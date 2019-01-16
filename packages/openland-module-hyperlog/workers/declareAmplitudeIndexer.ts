import { updateReader } from 'openland-module-workers/updateReader';
import { FDB } from 'openland-module-db/FDB';
import { createEmptyContext } from 'openland-utils/Context';
import request, { Response } from 'request';

export function declareAmplitudeIndexer() {
    if (process.env.AMPLITUDE_KEY) {
        let apiKey = process.env.AMPLITUDE_KEY;
        updateReader('amplitude-indexer', 1, FDB.HyperLog.createUserEventsStream(createEmptyContext(), 5), async (items) => {
            for (let i of items) {
                let event = i.body as { id: string, name: string, args: any, uid?: number, tid?: string, did: string };
                var eventData = {
                    user_id: event.uid,
                    device_id: event.did,
                    event_type: event.name,
                    event_properties:  event.args,
                    insert_id: event.id,
                };

                await new Promise((resolve, reject) => {
                    request.post({
                        url: 'https://api.amplitude.com/httpapi',
                        form: {
                            api_key: apiKey,
                            event: JSON.stringify(eventData)
                        }
                    }, function (err: any, response: Response, body: any) {
                        if (err) {
                            console.warn(err);
                            reject(err);
                        } else if (response.statusCode !== 200) {
                            console.warn(response);
                            reject(Error('Amplitude status ' + response.statusCode + ': "' + body + '"'));
                        } else {
                            resolve();
                        }
                    });
                });
            }
        });
    }
}