import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { initApi } from './initApi';
import { initHealthcheck } from './initHealthcheck';

export class ApiModule {
    start = async () => {
        if (serverRoleEnabled('api')) {
            await initApi(false);
        } else {
            if (!serverRoleEnabled('admin')) {
                await initHealthcheck();
            }
        }
    }
}