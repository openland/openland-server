import { forever, delay } from 'openland-utils/timer';
import { Context, createNamedContext } from '@openland/context';
import { inTx, transactional } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import { AnyJson } from '../../openland-utils/json';

export type EnvVarValueType = AnyJson;

const envVars = createNamedContext('env-vars');

export class EnvironmentVariablesRepository {

    private cached = new Map<string, any>();

    async start() {

        // Read initial
        await inTx(envVars, async (ctx) => {
            const variables = await Store.EnvironmentVariable.findAll(ctx);
            for (let v of variables) {
                try {
                    this.cached.set(v.name, JSON.parse(v.value));
                } catch (e) {
                    // Ignore
                }
            }
        });

        // Refresh cached
        forever(envVars, async () => {
            await inTx(envVars, async (ctx) => {
                const variables = await Store.EnvironmentVariable.findAll(ctx);
                for (let v of variables) {
                    try {
                        this.cached.set(v.name, JSON.parse(v.value));
                    } catch (e) {
                        // Ignore
                    }
                }
            });
            await delay(1000);
        });
    }

    @transactional
    async set<T extends EnvVarValueType>(ctx: Context, name: string, value: T, rawValue: boolean = false) {
        let existing = await Store.EnvironmentVariable.findById(ctx, name);
        let valueToWrite = rawValue ? (value as string) : JSON.stringify(value);

        if (existing) {
            existing.value = valueToWrite;
            await existing.flush(ctx);
        } else {
            let variable = await Store.EnvironmentVariable.create(ctx, name, { value: valueToWrite });
            await variable.flush(ctx);
        }
    }

    @transactional
    async get<T extends EnvVarValueType>(ctx: Context, name: string): Promise<T | null> {
        let existing = await Store.EnvironmentVariable.findById(ctx, name);

        if (existing) {
            try {
                return JSON.parse(existing.value);
            } catch (e) {
                return null;
            }
        } else {
            return null;
        }
    }

    getCached<T extends EnvVarValueType>(name: string): T | null {
        if (this.cached.has(name)) {
            return this.cached.get(name) as T;
        } else {
            return null;
        }
    }
}