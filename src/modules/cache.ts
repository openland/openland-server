import * as Redis from 'handy-redis';
import * as DataLoader from 'dataloader';

let client: Redis.IHandyRedis | null = null;
let hasCache = process.env.REDIS_HOST !== undefined;
function getClient(): Redis.IHandyRedis | null {
    if (hasCache) {
        let port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT as string, 10) : 6379;
        client = Redis.createHandyClient(port, process.env.REDIS_HOST);
    }
    return client;
}

let clientLoader = new DataLoader<string, number | null>(async (v) => {
    console.log(v);
    let client2 = getClient()!!;
    let res = (await client2.mget(...v)) as (string | null)[];
    let mappedRes = res.map((r) => {
        if (r) {
            try {
                return parseInt(r as string, 10);
            } catch (e) {
                return null;
            }
        } else {
            return null;
        }
    });
    console.log(mappedRes);
    return mappedRes;
});

export async function cachedInt(key: string, calc: () => Promise<number>): Promise<number> {
    if (hasCache) {
        let res = await clientLoader.load(key);
        if (res) {
            return res;
        }
        let r = await calc();
        getClient()!!.setex(key, 600, r.toString()).then((v) => clientLoader.clear(v));
        return r;
    } else {
        return calc();
    }
}

export async function cachedObject<T>(key: string, calc: () => Promise<T>): Promise<T> {
    if (hasCache) {
        let res = await getClient()!!.get(key);
        if (res) {
            try {
                return JSON.parse(res) as T;
            } catch (e) {
                // Ignore
            }
        }
        let r = await calc();
        getClient()!!.setex(key, 600, JSON.stringify(r)).then((v) => clientLoader.clear(v));
        return r;
    } else {
        return calc();
    }
}

export async function isCached(...keys: string[]): Promise<number[] | false> {
    let c = getClient();
    if (c) {
        let items = await clientLoader.loadMany(keys);
        for (let i of items) {
            let v = await i;
            if (v === null) {
                return false;
            }
        }
        return items as number[];
    } else {
        return false;
    }
}