import { Context } from '@openland/context';
import { transactional } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import { AnyJson } from '../../openland-utils/json';

export type EnvVarValueType = AnyJson;

export class EnvironmentVariablesRepository {

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
}