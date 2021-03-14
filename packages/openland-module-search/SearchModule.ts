import { ElasticService } from './services/ElasticService';
import { injectable } from 'inversify';
import * as ES from 'elasticsearch';

@injectable()
export class SearchModule {

    readonly elastic = new ElasticService();

    search<T>(params: ES.SearchParams): Promise<ES.SearchResponse<T>> {
        return this.elastic.client.search(params);
    }

    start = async () => {
        //
    }
}