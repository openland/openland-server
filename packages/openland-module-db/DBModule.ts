import { injectable } from 'inversify';

@injectable()
export class DBModule {

    start = () => {
        require('./FDB');
    }
}