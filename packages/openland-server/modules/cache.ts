import * as Redis from './redis/redis';
import DataLoader from 'dataloader';

let clientLoader = new DataLoader<string, number | null>(async (v) => {
    let client2 = Redis.redisClient()!!;
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
    return mappedRes;
});

export async function cachedInt(key: string, calc: () => Promise<number>): Promise<number> {
    if (Redis.redisEnabled) {
        let res = await clientLoader.load(key);
        if (res) {
            return res;
        }
        let r = await calc();
        // tslint:disable-next-line:no-floating-promises
        Redis.redisClient()!!.setex(key, 600, r.toString()).then((v) => clientLoader.clear(v));
        return r;
    } else {
        return calc();
    }
}

export async function cachedObject<T>(key: string, calc: () => Promise<T>): Promise<T> {
    if (Redis.redisEnabled) {
        let res = await Redis.redisClient()!!.get(key);
        if (res) {
            try {
                return JSON.parse(res) as T;
            } catch (e) {
                // Ignore
            }
        }
        let r = await calc();
        // tslint:disable-next-line:no-floating-promises
        Redis.redisClient()!!.setex(key, 600, JSON.stringify(r)).then((v) => clientLoader.clear(v));
        return r;
    } else {
        return calc();
    }
}

export async function isCached(...keys: string[]): Promise<number[] | false> {
    if (Redis.redisClient) {
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