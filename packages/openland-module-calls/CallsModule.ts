import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { CallRepository } from './repositories/CallRepository';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startCallReaper } from './worker/startCallReaper';

@injectable()
export class CallsModule {

    @lazyInject(CallRepository)
    repo!: CallRepository;

    start = async () => {
        if (serverRoleEnabled('workers')) {
            startCallReaper();
        }
    }
}