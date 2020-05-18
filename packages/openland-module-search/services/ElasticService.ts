import { Config } from 'openland-config/Config';
import * as ES from 'elasticsearch';

export class ElasticService {
    readonly client: ES.Client;
    readonly isWritable = Config.elasticsearch.writable;

    constructor(client: ES.Client) {
        this.client = client;
    }
}