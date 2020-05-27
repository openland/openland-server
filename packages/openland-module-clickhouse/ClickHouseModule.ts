import { injectable } from 'inversify';
import { startExporters } from './startExporters';
import { createNamedContext } from '@openland/context';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';
import { Table } from './schema/Table';
import { backoff } from '../openland-utils/timer';
import { createClient } from './migrations';
import { boolean, integer, schema, string } from './schema';

let ctx = createNamedContext('clickhouse');
@injectable()
export class ClickHouseModule {
    start = async () => {
        if (serverRoleEnabled('admin')) {
            startExporters(ctx);
            let client = await backoff(ctx, () => createClient(ctx));
            const testTable = new Table(client, 'test2', schema({
                id: integer(),
                lol: string(),
                kek: integer(),
                flex: boolean(),
            }), {
                id: 'id',
                orderBy: 'id',
                partition: 'id'
            });

            await testTable.init(ctx);
        }
    }
}