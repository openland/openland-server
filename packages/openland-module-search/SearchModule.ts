import * as ES from 'elasticsearch';
import { ElasticService } from './services/ElasticService';
import { injectable } from 'inversify';

@injectable()
export class SearchModule {

    readonly elastic = new ElasticService(new ES.Client({ host: process.env.ELASTIC_ENDPOINT }));

    start = () => {
        //
    }
}