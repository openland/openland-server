import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { CallRepository } from './repositories/CallRepository';

@injectable()
export class CallsModule {
    
    @lazyInject(CallRepository)
    repo!: CallRepository;

    start = async () => {
        //
    }
}