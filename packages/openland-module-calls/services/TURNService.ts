import Twilio from 'twilio';

let twillioApi: Twilio.Twilio | undefined;
if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
    twillioApi = Twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
}
let iceServers: any | undefined = undefined;
let iceServerExpire: number | undefined = undefined;

export async function resolveTurnServices() {
    if (twillioApi) {
        let now = Date.now();
        if (iceServers) {
            if (now < iceServerExpire!) {
                return iceServers;
            }
        }
        let res = await twillioApi.tokens.create();
        let iceServersRaw = res.iceServers as any as [{ url: string, username?: string, credential?: string }];
        iceServers = iceServersRaw.map((v) => ({
            urls: v.url,
            username: v.username,
            credential: v.credential
        }));
        iceServerExpire = now + (res.ttl as any as number) / 2;
        return iceServers;
    }
    return [{
        urls: ['turn:35.237.41.98:443?transport=tcp'],
        username: 'somecalluser',
        credential: 'samplepassword',
    }, {
        urls: ['stun:35.237.41.98:443?transport=tcp'],
        username: 'somecalluser',
        credential: 'samplepassword',
    }, {
        urls: ['turn:35.228.111.16:443?transport=tcp'],
        username: 'somecalluser',
        credential: 'samplepassword',
    }, {
        urls: ['stun:35.228.111.16:443?transport=tcp'],
        username: 'somecalluser',
        credential: 'samplepassword',
    }, {
        urls: ['turn:35.241.89.108:443?transport=tcp'],
        username: 'somecalluser',
        credential: 'samplepassword',
    }, {
        urls: ['stun:35.241.89.108:443?transport=tcp'],
        username: 'somecalluser',
        credential: 'samplepassword',
    }];
}