import { PushModule } from 'openland-module-push/PushModule';
import { WorkerModule } from 'openland-module-workers/WorkerModule';
import { DBModule } from 'openland-module-db/DBModule';

class ModulesImpl {
    readonly DB = new DBModule();
    readonly Workers = new WorkerModule();
    readonly Push = new PushModule();

    start = () => {
        this.DB.start();
        this.Workers.start();
        this.Push.start();
    }
}

export const Modules = new ModulesImpl();