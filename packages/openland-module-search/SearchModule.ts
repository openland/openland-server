import { ElasticService } from './services/ElasticService';
import { injectable } from 'inversify';

@injectable()
export class SearchModule {

    readonly elastic = new ElasticService();

    start = async () => {
        //
    }
}