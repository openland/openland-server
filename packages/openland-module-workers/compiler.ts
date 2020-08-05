import { extension } from "@openland/foundationdb-compiler";

export function taskQueue(name: string) {
    extension(name, 'com.openland.tasks', {
        header: (b) => {
            b.append(`// @ts-ignore`);
            b.append(`import { QueueStorage } from 'openland-module-workers/QueueStorage'`);
        },
        field: () => ({
            fieldName: name + 'Queue',
            typename: 'QueueStorage',
            init: `QueueStorage.open('${name}', storage)`
        })
    });
}