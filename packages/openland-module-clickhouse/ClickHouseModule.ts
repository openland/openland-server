import { injectable } from 'inversify';
import { startExporters } from './startExporters';
import { createNamedContext } from '@openland/context';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';

@injectable()
export class ClickHouseModule {
    start = () => {
        if (serverRoleEnabled('admin')) {
            startExporters(createNamedContext('clickhouse'));
        }
    }
}