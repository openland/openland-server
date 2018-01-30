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
        try {
            let res = await c.get(key);
            if (res) {
                return parseInt(res, 10);
            }
        } catch (e) {
            // just ignore
        }
        let r = await calc();
        await c.setex(key, 600, r.toString());
        return r;
    } else {
        return calc();
    }
}

export async function isCached(...keys: string[]): Promise<number[] | false> {
    let c = getClient();
    if (c) {
        let items = keys.map((v) => c!!.get(v));
        let res = [];
        for (let i of items) {
            let v = await i;
            if (v === null) {
                return false;
            } else {
                try {
                    res.push(parseInt(v, 10));
                } catch (e) {
                    // just ignore
                }
            }
        }
        return res;
    } else {
        return false;
    }
}