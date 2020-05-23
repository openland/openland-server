import { injectable } from 'inversify';

@injectable()
export class DBModule {

    start = async () => {
        require('./FDB');
    }
}