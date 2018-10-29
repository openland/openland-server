import { declareHyperlogIndexer } from './workers/declareHyperlogIndexer';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';

export class HyperlogModule {
    start = () => {
        if (serverRoleEnabled('workers')) {
            declareHyperlogIndexer();
        }
    }
}