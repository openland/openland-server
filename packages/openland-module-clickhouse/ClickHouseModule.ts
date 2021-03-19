import { injectable } from 'inversify';
import { startExporters } from './startExporters';
import { createNamedContext } from '@openland/context';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';

let ctx = createNamedContext('clickhouse');
@injectable()
export class ClickHouseModule {
    start = async () => {
        if (serverRoleEnabled('admin')) {
            startExporters(ctx);
        }
    }
}