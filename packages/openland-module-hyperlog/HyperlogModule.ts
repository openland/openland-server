import { declareHyperlogIndexer } from './workers/declareHyperlogIndexer';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { injectable } from 'inversify';
import { declareAmplitudeIndexer } from './workers/declareAmplitudeIndexer';

@injectable()
export class HyperlogModule {
    start = () => {
        if (serverRoleEnabled('admin')) {
            declareHyperlogIndexer();
            declareAmplitudeIndexer();
        }
    }
}