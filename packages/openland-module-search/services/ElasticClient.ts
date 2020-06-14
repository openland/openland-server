import * as ES from 'elasticsearch';

export class ElasticClient {
    private readonly _client: ES.Client;
    private readonly _writable: boolean;

    constructor(client: ES.Client, writable: boolean) {
        this._client = client;
        this._writable = writable;
    }

    msearch<T>(params: ES.MSearchParams): Promise<ES.MSearchResponse<T>> {
        return this._client.msearch(params);
    }
    search<T>(params: ES.SearchParams): Promise<ES.SearchResponse<T>> {
        return this._client.search(params);
    }

    get writable() {
        return this._writable;
    }

    get writableClient() {
        if (!this._writable) {
            throw Error('Client is not writable!');
        }
        return this._client;
    }
}