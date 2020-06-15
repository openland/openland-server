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
        for (let cluster of Config.elasticsearch.clusters!) {
            if (this.clusters.find((v) => v === cluster.name)) {
                continue;
            }
            this.clusters.push(cluster.name);
            let client = new ES.Client({ host: cluster.endpoint, apiVersion: cluster.version ? cluster.version : undefined });
            if (cluster.writable !== false) {
                this.clusterMap.set(cluster.name, client);
                log.log(ctx, 'Loaded cluster ' + cluster.name + ': ' + cluster.endpoint);
            }
            if (cluster.name === Config.elasticsearch.primary) {
                this.client = new ElasticClient(client);
                defaultSet = true;
            }
        }

        // Use default settings if default endpoint is not explicitly defined
        if (!defaultSet) {
            throw Error('Unable to find primary cluster: "' + Config.elasticsearch.primary + '"');
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