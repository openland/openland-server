import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { ElasticClient } from './ElasticClient';
import { Config } from 'openland-config/Config';
import * as ES from 'elasticsearch';

const log = createLogger('elastic');
const ctx = createNamedContext('init');

export class ElasticService {
    readonly client!: ElasticClient;
    readonly clusterMap = new Map<string, ES.Client>();
    readonly clusters: string[] = [];

    constructor() {

        // Connected Clusters
        let defaultSet = false;
        if (Config.elasticsearch.clusters) {
            for (let secondary of Config.elasticsearch.clusters!) {
                if (this.clusters.find((v) => v === secondary.name)) {
                    continue;
                }
                this.clusters.push(secondary.name);
                let client = new ES.Client({ host: secondary.endpoint });
                if (Config.elasticsearch.writable) {
                    this.clusterMap.set('default', client);
                    log.log(ctx, 'Loaded cluster ' + secondary.name + ': ' + secondary.endpoint);
                }
                if (secondary.name === 'default') {
                    this.client = new ElasticClient(client);
                    defaultSet = true;
                }
            }
        }

        // Use default settings if default endpoint is not explicitly defined
        if (!defaultSet) {
            let client = new ES.Client({ host: Config.elasticsearch.endpoint });
            this.client = new ElasticClient(client);

            if (Config.elasticsearch.writable) {
                log.log(ctx, 'Loaded cluster <default>: ' + Config.elasticsearch.endpoint);
                this.clusterMap.set('default', client);
                this.clusters.push('default');
            }
        }
    }

    getWritableClient(name: string): ES.Client | null {
        if (this.clusterMap.has(name)) {
            return this.clusterMap.get(name)!;
        } else {
            return null;
        }
    }
}