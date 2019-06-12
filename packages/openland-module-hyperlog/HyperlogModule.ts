import { declareHyperlogIndexer } from './workers/declareHyperlogIndexer';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { injectable } from 'inversify';
import { declareAmplitudeIndexer } from './workers/declareAmplitudeIndexer';
import { declareBatchAmplitudeIndexer } from './workers/declareBatchAmplitudeIndexer';

@injectable()
export class HyperlogModule {
    start = () => {
        if (serverRoleEnabled('admin')) {
            declareHyperlogIndexer();
            declareAmplitudeIndexer();
            declareBatchAmplitudeIndexer();
        }
    }
}