import * as ES from 'elasticsearch';

export class ElasticService {
    readonly client: ES.Client;
    readonly isWritable = process.env.ELASTIC_ENABLE_INDEXING !== 'false';

    constructor(client: ES.Client) {
        this.client = client;
    }
}