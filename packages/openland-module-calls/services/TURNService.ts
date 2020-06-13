import { Modules } from '../../openland-modules/Modules';
import { Config } from 'openland-config/Config';
import Twilio from 'twilio';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { pickClosest } from 'openland-utils/geo';

let twillioApi = Twilio(Config.twillio.sid, Config.twillio.token);
let iceServers: any | undefined = undefined;
let iceServerExpire: number | undefined = undefined;

export async function resolveTurnServices(ctx: Context) {
    let useCustomTurns = await Modules.Super.getEnvVar<boolean>(ctx, 'custom-turns-enabled') || false;
    let workers = (await Store.KitchenWorker.active.findAll(ctx))
        .filter((v) => v.appData && typeof v.appData.ip === 'string');

    // Resolve twillio turn servers if workers are missing or twillio is enforced
    if (twillioApi && Config.environment === 'production' && !useCustomTurns || workers.length === 0) {
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

    // Resolve Location
    let requestLocation = { lat: 37.773972, long: -122.431297 }; // Default is SF
    if (ctx.req.latLong) {
        requestLocation = ctx.req.latLong;
    }

    // Find closest
    let nearest = pickClosest({
        location: requestLocation,
        data: workers,
        ipExtractor: (src) => src.appData.ip,
        tolerance: 10
    });
    let ip = nearest.appData.ip as string;

    let enableTcp = await Modules.Super.getEnvVar<boolean>(ctx, 'custom-enable-tcp') || false;

    let turns: {
        ip: string,
        urls: string[],
        username: string,
        credential: string
    }[] = [];

    const stun = {
        ip: ip,
        urls: ['stun:' + ip + ':3478'],
        username: 'user',
        credential: 'emFsdXBhCg',
    };
    // const turnAll = {
    //     ip: ip,
    //     urls: ['stun:' + ip + ':3478'],
    //     username: 'user',
    //     credential: 'emFsdXBhCg',
    // };
    const turnTcp = {
        ip: ip,
        urls: ['turn:' + ip + ':3478?transport=tcp'],
        username: 'user',
        credential: 'emFsdXBhCg',
    };
    const turnUdp = {
        ip: ip,
        urls: ['turn:' + ip + ':3478?transport=udp'],
        username: 'user',
        credential: 'emFsdXBhCg',
    };
    turns.push(stun);
    turns.push(turnUdp);
    if (enableTcp) {
        turns.push(turnTcp);
    }

    return turns;
}