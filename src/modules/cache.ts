import * as Redis from 'handy-redis';

let client: Redis.IHandyRedis | null = null;

function getClient(): Redis.IHandyRedis | null {
    if (process.env.REDIS_HOST) {
        let port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT as string, 10) : 6379;
        client = Redis.createHandyClient(port, process.env.REDIS_HOST);
    }
    return client;
}

export async function cachedInt(key: string, calc: () => Promise<number>): Promise<number> {
    let c = getClient();
    if (c) {
        let res = await c.get(key);
        if (res) {
            return parseInt(res, 10);
        } else {
            let r = await calc();
            await c.setex(key, 600, r.toString());
            return r;
        }
    } else {
        return calc();
    }
}