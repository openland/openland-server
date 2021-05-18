import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { injectable } from 'inversify';
import { declareHyperlogReaper } from './workers/declareHyperlogReaper';

@injectable()
export class HyperlogModule {
    start = async () => {
        if (serverRoleEnabled('workers')) {
            declareHyperlogReaper();
        }
    }
}