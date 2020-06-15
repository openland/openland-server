import * as ES from 'elasticsearch';

export class ElasticClient {
    private readonly _client: ES.Client;

    constructor(client: ES.Client) {
        this._client = client;
    }

    msearch<T>(params: ES.MSearchParams): Promise<ES.MSearchResponse<T>> {
        return this._client.msearch(params);
    }
    search<T>(params: ES.SearchParams): Promise<ES.SearchResponse<T>> {
        return this._client.search(params);
    }
}