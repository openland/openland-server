import { Config } from 'openland-config/Config';
import Twilio from 'twilio';

let twillioApi = Twilio(Config.twillio.sid, Config.twillio.token);
let iceServers: any | undefined = undefined;
let iceServerExpire: number | undefined = undefined;

export async function resolveTurnServices() {
    if (twillioApi && Config.environment === 'production') {
        let now = Date.now();
        if (iceServers) {
            if (now < iceServerExpire!) {
                return iceServers;
            }
        }
        let res = await twillioApi.tokens.create();
        let iceServersRaw = res.iceServers as any as [{ url: string, username?: string, credential?: string }];
        iceServers = iceServersRaw.map((v) => ({
            urls: [v.url],
            username: v.username,
            credential: v.credential
        }));
        iceServerExpire = now + ((parseInt(res.ttl, 10)) * 1000 / 2);
        return iceServers;
    }
    return [{
        ip: '35.228.24.228',
        urls: ['turn:35.228.24.228:3478'],
        username: 'user',
        credential: 'emFsdXBhCg',
    }, {
        ip: '35.245.151.83',
        urls: ['turn:35.245.151.83:3478'],
        username: 'user',
        credential: 'cGl6ZGFyaWsK',
    }];
}