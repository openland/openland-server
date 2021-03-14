import { ElasticService } from './services/ElasticService';
import { injectable } from 'inversify';
import * as ES from 'elasticsearch';
import { Context } from '@openland/context';

@injectable()
export class SearchModule {

    readonly elastic = new ElasticService();

    search<T>(ctx: Context, params: ES.SearchParams): Promise<ES.SearchResponse<T>> {
        return this.elastic.client.search(params);
    }

    start = async () => {
        //
    }
}