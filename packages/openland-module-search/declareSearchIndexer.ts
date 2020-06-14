import { updateReader } from 'openland-module-workers/updateReader';
import { Modules } from 'openland-modules/Modules';
import { Context, createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { Stream } from '@openland/foundationdb-entity/lib/Stream';

const log = createLogger('elastic-indexer');
const rootCtx = createNamedContext('init');

type SearchFieldType = 'integer' | 'keyword' | 'text' | 'boolean' | 'date' | 'long';

type ToType<T extends SearchFieldType> =
    T extends 'integer' ? number :
    T extends 'keyword' ? any :
    T extends 'text' ? string :
    T extends 'boolean' ? boolean :
    T extends 'date' ? number :
    T extends 'long' ? number : never;

type SearchIndexerProperties = { [key: string]: { type: SearchFieldType } };

type HandlerReturnType<P extends SearchIndexerProperties> = { [K in keyof P]?: ToType<P[K]['type']> };

export class SearchIndexer<T, P extends SearchIndexerProperties> {
    readonly name: string;
    readonly version: number;
    readonly index: string;
    readonly stream: Stream<T>;
    properties?: SearchIndexerProperties;
    readonly excludedClusters: string[];
    readonly includedClusters: string[];

    constructor(opts: { name: string, version: number, index: string, stream: Stream<T>, excludedClusters?: string[], includedClusters?: string[] }) {
        this.name = opts.name;
        this.version = opts.version;
        this.index = opts.index;
        this.stream = opts.stream;
        this.excludedClusters = opts.excludedClusters || [];
        this.includedClusters = opts.includedClusters || [];
    }

    withProperties<Pr extends SearchIndexerProperties>(properties: Pr) {
        let indexer = new SearchIndexer<T, Pr>({
            name: this.name,
            version: this.version,
            index: this.index,
            stream: this.stream,
            excludedClusters: this.excludedClusters,
            includedClusters: this.includedClusters
        });
        indexer.properties = properties;
        return indexer;
    }

    start(handler: (item: T, ctx: Context) => Promise<{ id: string | number, doc: HandlerReturnType<P> } | null>) {
        let clusters: string[] = Modules.Search.elastic.clusters;

        // Start indexer for each cluster
        for (let cluster of clusters) {

            // Check if cluster is included
            if (this.includedClusters.length > 0) {
                if (!this.includedClusters.find((v) => v === cluster)) {
                    continue;
                }
            }

            // Check if cluster is excluded
            if (this.excludedClusters.find((v) => v === cluster)) {
                continue;
            }

            // Resolve cluster indexer name
            let name = this.name + ':' + cluster;
            if (cluster === 'default') {
                name = this.name;
            }

            // Resolve writable cluster
            let client = Modules.Search.elastic.getWritableClient(cluster)!;
            if (!client) {
                continue;
            }

            log.log(rootCtx, 'Start indexer: ' + name + '(' + cluster + ')');

            updateReader('index-' + name, this.version, this.stream, async (items, first, ctx) => {
                if (first) {
                    if (await client.indices.exists({ index: this.index }) !== true) {
                        log.log(ctx, 'Creating index ' + name);
                        await client.indices.create({ index: this.index });
                    }
                    if (this.properties) {
                        try {
                            log.log(ctx, 'Updating properties of ' + name);
                            await client.indices.putMapping({
                                index: this.index, type: this.index, body: {
                                    properties: this.properties
                                }
                            });
                        } catch (e) {
                            if (e.body && e.body.error && e.body.error.type && e.body.error.type === 'illegal_argument_exception') {
                                log.log(ctx, 'Deleting ' + name);
                                await client.indices.delete({ index: this.index });
                            }
                            throw e;
                        }
                    }
                }
                let converted: any[] = [];
                for (let i of items) {
                    // TODO: Reimplement
                    // log.log(ctx, this.name, 'Indexing ' + i.rawId.join('.'));
                    let c = await handler(i, ctx);
                    if (c) {
                        converted.push({
                            index: {
                                _index: this.index,
                                _type: this.index,
                                _id: c.id
                            }
                        });
                        converted.push(c.doc);
                    }
                }
                if (converted.length > 0) {
                    try {
                        let res = await client.bulk({
                            body: converted,
                        });
                        if (res.errors) {
                            log.warn(ctx, 'Elastic error', res, 'Errors: ', JSON.stringify(res.items.filter((i: any) => i.index.error)));
                            throw new Error('Error during indexing (' + name + ')');
                        }
                    } catch (e) {
                        log.warn(ctx, e);
                        throw e;
                    }
                }
            }, { delay: 0 });
        }
    }
}

export function declareSearchIndexer<T>(opts: { name: string, version: number, index: string, stream: Stream<T>, excludedClusters?: string[], includedClusters?: string[] }) {
    return new SearchIndexer(opts);
}