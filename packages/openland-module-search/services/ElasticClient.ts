import * as ES from 'elasticsearch';

export class ElasticClient {
    private readonly _client: ES.Client;

    constructor(client: ES.Client) {
        this._client = client;
    }

    search<T>(params: ES.SearchParams): Promise<ES.SearchResponse<T>> {
        return this._client.search(params);
    }
}