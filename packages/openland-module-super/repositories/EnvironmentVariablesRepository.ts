import { AllEntities } from '../../openland-module-db/schema';
import { Context } from '../../openland-utils/Context';
import { inTx } from '../../foundation-orm/inTx';

export type EnvVarValueType = number | string | boolean;

export class EnvironmentVariablesRepository {
    private readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async set<T extends EnvVarValueType>(parent: Context, name: string, value: T, rawValue: boolean = false) {
        return await inTx(parent, async (ctx) => {
            let existing = await this.entities.EnvironmentVariable.findById(ctx, name);
            let valueToWrite = rawValue ? (value as string) : JSON.stringify(value);

            if (existing) {
                existing.value = valueToWrite;
                await existing.flush();
            } else {
                let variable = await this.entities.EnvironmentVariable.create(ctx, name, { value: valueToWrite });
                await variable.flush();
            }
        });
    }

    async get<T extends EnvVarValueType>(parent: Context, name: string): Promise<T | null> {
        return await inTx(parent, async (ctx) => {
            let existing = await this.entities.EnvironmentVariable.findById(ctx, name);

            if (existing) {
                try {
                    return JSON.parse(existing.value);
                } catch (e) {
                    return null;
                }
            } else {
                return null;
            }
        });
    }
}