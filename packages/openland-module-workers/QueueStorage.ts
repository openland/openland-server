import { createNamedContext } from '@openland/context';
import { EntityStorage } from '@openland/foundationdb-entity';
import { inTx, encoders, Subspace } from '@openland/foundationdb';

export class QueueStorage {

    static async open(name: string, storage: EntityStorage) {
        let resolved = await inTx(createNamedContext('entity'), async (ctx) => {

            // Map id
            let registryDirectory = (await storage.db.directories.createOrOpen(ctx, ['com.openland.tasks', 'registry']))
                .withKeyEncoding(encoders.tuple)
                .withValueEncoding(encoders.int32LE);
            let id: number;
            let existing = await registryDirectory.get(ctx, [name]);
            if (!existing) {
                let lastCounter = (await registryDirectory.get(ctx, [])) || 0;
                let newValue = lastCounter++;
                registryDirectory.set(ctx, [], newValue);
                registryDirectory.set(ctx, [name], newValue);
                id = newValue;
            } else {
                id = existing;
            }

            // Tasks directory
            let tasksDirectory = (await storage.db.directories.createOrOpen(ctx, ['com.openland.tasks', 'tasks']));

            return {
                id,
                subspace: tasksDirectory
            }
        });
        return new QueueStorage(name, resolved.id, resolved.subspace, storage);
    }

    readonly name: string;
    readonly id: number;
    readonly subspace: Subspace;
    readonly storage: EntityStorage;

    private constructor(name: string, id: number, subspace: Subspace, storage: EntityStorage) {
        this.name = name;
        this.id = id;
        this.subspace = subspace;
        this.storage = storage;
    }
}