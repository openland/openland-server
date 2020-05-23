import { createNamedContext } from '@openland/context';
import { declareHyperlogIndexer } from './workers/declareHyperlogIndexer';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { injectable } from 'inversify';
import { startExporters } from './clickhouse/startExporters';

@injectable()
export class HyperlogModule {
    start = async () => {
        if (serverRoleEnabled('admin')) {
            declareHyperlogIndexer();
            startExporters(createNamedContext('hyperlog'));
        }
    }
}