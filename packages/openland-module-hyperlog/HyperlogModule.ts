import { declareHyperlogIndexer } from './workers/declareHyperlogIndexer';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { injectable } from 'inversify';
import { declareBatchAmplitudeIndexer } from './workers/declareBatchAmplitudeIndexer';

@injectable()
export class HyperlogModule {
    start = () => {
        if (serverRoleEnabled('admin')) {
            declareHyperlogIndexer();
            declareBatchAmplitudeIndexer();
        }
    }
}