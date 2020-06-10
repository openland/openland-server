import { Modules } from '../../openland-modules/Modules';
import { Config } from 'openland-config/Config';
import Twilio from 'twilio';
import { Context } from '@openland/context';

let twillioApi = Twilio(Config.twillio.sid, Config.twillio.token);
let iceServers: any | undefined = undefined;
let iceServerExpire: number | undefined = undefined;

export async function resolveTurnServices(ctx: Context) {
    let useCustomTurns = await Modules.Super.getEnvVar<boolean>(ctx, 'custom-turns-enabled') || false;

    if (twillioApi && Config.environment === 'production' && !useCustomTurns) {
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

    let kitchenIceServers = Modules.Calls.mediaKitchen.cluster.workers.map(a => ({
        ip: a.appData.ip as string,
        urls: ['turn:' + a.appData.ip + ':3478'],
        username: 'user',
        credential: 'emFsdXBhCg',
    }));

    return [
        ...kitchenIceServers,
        // {
        //     ip: '35.228.24.228',
        //     urls: ['turn:35.228.24.228:3478'],
        //     username: 'user',
        //     credential: 'emFsdXBhCg',
        // }, {
        //     ip: '35.245.151.83',
        //     urls: ['turn:35.245.151.83:3478'],
        //     username: 'user',
        //     credential: 'cGl6ZGFyaWsK',
        // }
    ];
}