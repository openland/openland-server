import * as Redis from 'handy-redis';

let client: Redis.IHandyRedis | null = null;
// let subscriber: Redis.IHandyRedis | null = null;
let hasCache = process.env.REDIS_HOST !== undefined && process.env.DISABLE_CACHE !== 'true';
function getClient(): Redis.IHandyRedis | null {
    if (hasCache) {
        let port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT as string, 10) : 6379;
        client = Redis.createHandyClient(port, process.env.REDIS_HOST);
    }
    return client;
}
// function getSubsctiberClient(): Redis.IHandyRedis | null {
//     if (hasCache) {
//         let port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT as string, 10) : 6379;
//         subscriber = Redis.createHandyClient(port, process.env.REDIS_HOST);
//     }
//     return subscriber;
// }

export const redisEnabled = hasCache;
export const redisClient = getClient;
// export const redisSubscriberClient = getSubsctiberClient();
