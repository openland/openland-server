import { injectable } from 'inversify';
import { startExporters } from './startExporters';
import { createNamedContext } from '@openland/context';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';
import { Config } from '../openland-config/Config';

let ctx = createNamedContext('clickhouse');
@injectable()
export class ClickHouseModule {
    start = async () => {
        if (serverRoleEnabled('admin') && Config.environment !== 'debug') {
            startExporters(ctx);
        }
    }
}