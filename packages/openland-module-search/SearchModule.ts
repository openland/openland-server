import * as ES from 'elasticsearch';
import { ElasticService } from './services/ElasticService';

export class SearchModule {

    readonly elastic = new ElasticService(new ES.Client({ host: process.env.ELASTIC_ENDPOINT }));

    start = () => {
        //
    }
}