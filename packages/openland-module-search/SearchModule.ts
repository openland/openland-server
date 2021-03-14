import { ElasticService } from './services/ElasticService';
import { injectable } from 'inversify';
import * as ES from 'elasticsearch';
import { Context } from '@openland/context';
import { createTracer } from 'openland-log/createTracer';

const tracer = createTracer('elastic');
@injectable()
export class SearchModule {

    readonly elastic = new ElasticService();

    search<T>(ctx: Context, params: ES.SearchParams): Promise<ES.SearchResponse<T>> {
        return tracer.trace(ctx, 'search', () => this.elastic.client.search(params));
    }

    start = async () => {
        //
    }
}