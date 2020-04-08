// import Twilio from 'twilio';
//
// let twillioApi: Twilio.Twilio | undefined;
// if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
//     twillioApi = Twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
// }
// let iceServers: any | undefined = undefined;
// let iceServerExpire: number | undefined = undefined;

export async function resolveTurnServices() {
    // if (twillioApi) {
    //     let now = Date.now();
    //     if (iceServers) {
    //         if (now < iceServerExpire!) {
    //             return iceServers;
    //         }
    //     }
    //     let res = await twillioApi.tokens.create();
    //     let iceServersRaw = res.iceServers as any as [{ url: string, username?: string, credential?: string }];
    //     iceServers = iceServersRaw.map((v) => ({
    //         urls: [v.url],
    //         username: v.username,
    //         credential: v.credential
    //     }));
    //     iceServerExpire = now + ((parseInt(res.ttl, 10)) * 1000 / 2);
    //     return iceServers;
    // }
    return [{
        urls: ['turn:35.228.24.228:3478'],
        username: 'user',
        credential: 'emFsdXBhCg',
    }, {
        urls: ['stun:35.228.24.228:3478'],
        username: 'user',
        credential: 'emFsdXBhCg',
    }, {
        urls: ['turn:35.245.151.83:3478'],
        username: 'user',
        credential: 'cGl6ZGFyaWsK',
    }, {
        urls: ['stun:35.245.151.83:3478'],
        username: 'user',
        credential: 'cGl6ZGFyaWsK',
    }];
}