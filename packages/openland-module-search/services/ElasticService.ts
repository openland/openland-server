import { ElasticClient } from './ElasticClient';
import { Config } from 'openland-config/Config';
import * as ES from 'elasticsearch';

export class ElasticService {
    readonly client: ElasticClient;
    readonly isWritable = Config.elasticsearch.writable;

    constructor(client: ES.Client) {
        this.client = new ElasticClient(client, Config.elasticsearch.writable);
    }
}