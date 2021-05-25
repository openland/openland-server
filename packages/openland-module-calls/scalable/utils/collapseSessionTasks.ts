import { ScalableSessionTask } from '../ScalableMediator';

export function collapseSessionTasks(tasks: ScalableSessionTask[]) {
    let toRemove = new Set<number>();
    for (let t of tasks) {
        if (t.type === 'remove') {
            toRemove.add(t.pid);
        }
    }

    let toAdd = new Map<number, { pid: number, consumer: boolean, producer: boolean }>();
    for (let t of tasks) {
        if (t.type === 'add') {
            if (toRemove.has(t.pid)) {
                continue;
            }
            toAdd.set(t.pid, { pid: t.pid, consumer: true, producer: t.role === 'speaker' });
        }
    }

    let toUpdate = new Map<number, { pid: number, consumer: boolean, producer: boolean }>();
    for (let t of tasks) {
        if (t.type === 'role-change') {
            if (toRemove.has(t.pid)) {
                continue;
            }
            if (toAdd.has(t.pid)) {
                toAdd.set(t.pid, { pid: t.pid, consumer: true, producer: t.role === 'speaker' });
                continue;
            }
            toUpdate.set(t.pid, { pid: t.pid, consumer: true, producer: t.role === 'speaker' });
        }
    }

    return {
        remove: Array.from(toRemove),
        add: Array.from(toAdd.values()),
        update: Array.from(toUpdate.values())
    };
}