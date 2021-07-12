import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../openland-module-db/FDB';
import * as base64 from './base64';
import { randomBytes } from 'crypto';
import { randomNumbersString } from './random';

class OneTimeCodeRepo<Data> {
    private service: string;
    private ttl: number;
    private maxAttempts: number;
    private codeLength: number;

    // ttl is in seconds
    constructor(service: string, ttl: number, maxAttempts: number, codeLength: number) {
        this.service = service;
        this.ttl = ttl;
        this.maxAttempts = maxAttempts;
        this.codeLength = codeLength;
    }

    async create(parent: Context, data: Data) {
        return await inTx(parent, async ctx => {
            let now = Math.floor(Date.now() / 1000);
            return await Store.OneTimeCode.create(ctx, this.service, base64.encodeBuffer(randomBytes(64)), {
                code: randomNumbersString(this.codeLength),
                expires: now + this.ttl,
                attemptsCount: 0,
                data,
                enabled: true
            });
        });
    }

    async findById(parent: Context, id: string) {
        return await inTx(parent, async ctx => {
            let now = Math.floor(Date.now() / 1000);
            let res = await Store.OneTimeCode.findById(ctx, this.service, id);
            if (res && res.enabled && res.expires > now && res.attemptsCount <= this.maxAttempts) {
                return {
                    id: res.id,
                    data: res.data as Data,
                    code: res.code
                };
            }
            return null;
        });
    }

    async isExpired(parent: Context, id: string) {
        return await inTx(parent, async ctx => {
            let now = Math.floor(Date.now() / 1000);
            let res = await Store.OneTimeCode.findById(ctx, this.service, id);
            if (!res || !res.enabled) {
                return false;
            }
            if (res.expires < now || res.attemptsCount <= this.maxAttempts)  {
                return true;
            }
            return false;
        });
    }

    // async findByCode(parent: Context, code: string) {
    //     return await inTx(parent, async ctx => {
    //         let now = Math.floor(Date.now() / 1000);
    //         let res = await Store.OneTimeCode.code.find(ctx, this.service, code);
    //         if (res && res.enabled && res.expires > now && res.attemptsCount <= this.maxAttempts) {
    //             return res;
    //         }
    //         return null;
    //     });
    // }

    async onUseAttempt(parent: Context, id: string) {
        return await inTx(parent, async ctx => {
            let res = await Store.OneTimeCode.findById(ctx, this.service, id);
            if (res) {
                res.attemptsCount++;
                await res.flush(ctx);
            }
        });
    }

    // async onUse(parent: Context, code: string) {
    //     return await inTx(parent, async ctx => {
    //         let res = await Store.OneTimeCode.code.find(ctx, this.service, code);
    //         if (res) {
    //             res.enabled = false;
    //             await res.flush(ctx);
    //         }
    //     });
    // }
}

export function createOneTimeCodeGenerator<T>(service: string, ttl: number, maxAttempts: number, codeLength: number) {
    return new OneTimeCodeRepo<T>(service, ttl, maxAttempts, codeLength);
}
