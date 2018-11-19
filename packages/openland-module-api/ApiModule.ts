import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { initApi } from './initApi';
import { initHealthcheck } from './initHealthcheck';
import { injectable } from 'inversify';
import { GQL_SPEC_VERSION } from './schema/SchemaSpec';
import { getSchemeVersion } from './schema/SchemaSpecGenerator';
import { buildSchema } from '../openland-graphql/buildSchema';

@injectable()
export class ApiModule {
    start = async () => {
        console.log('start API Module');
        if (serverRoleEnabled('api')) {
            console.log(GQL_SPEC_VERSION, getSchemeVersion(buildSchema(__dirname + '/../')));

            if (GQL_SPEC_VERSION !== getSchemeVersion(buildSchema(__dirname + '/../'))) {
                throw new Error('Schema version mismatch, did you forgot to run yarn schema:gen ?');
            }
            await initApi(false);
        } else {
            if (!serverRoleEnabled('admin')) {
                await initHealthcheck();
            }
        }
    }
}