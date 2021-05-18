import { updateReader } from 'openland-module-workers/updateReader';
import { Modules } from 'openland-modules/Modules';
import { Context, createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { Stream } from '@openland/foundationdb-entity/lib/Stream';

const log = createLogger('elastic-indexer');
const rootCtx = createNamedContext('init');

type SearchFieldType = 'integer' | 'keyword' | 'text' | 'boolean' | 'date' | 'long';

type MaybeArray<T> = T | T[];

type ToType<T extends SearchFieldType> =
    T extends 'integer' ? MaybeArray<number> :
    T extends 'keyword' ? any :
    T extends 'text' ? string :
    T extends 'boolean' ? boolean :
    T extends 'date' ? number :
    T extends 'long' ? number : never;

type SearchIndexerProperties = { [key: string]: { type: SearchFieldType } };

type HandlerReturnType<P extends SearchIndexerProperties> = { [K in keyof P]?: ToType<P[K]['type']> };

export class SearchIndexer<T, P extends SearchIndexerProperties, S> {
    readonly name: string;
    readonly version: number;
    readonly index: string;
    readonly stream: Stream<T>;
    properties?: SearchIndexerProperties;
    settings?: any;
    readonly excludedClusters: string[];
    readonly includedClusters: string[];
    afterProcessed?: (cursor: string, ctx: Context) => void | Promise<void>;

    constructor(opts: { name: string, version: number, index: string, stream: Stream<T>, excludedClusters?: string[], includedClusters?: string[] }) {
        this.name = opts.name;
        this.version = opts.version;
        this.index = opts.index;
        this.stream = opts.stream;
        this.excludedClusters = opts.excludedClusters || [];
        this.includedClusters = opts.includedClusters || [];
    }

    withAfterHandler(handler: (cursor: string, ctx: Context) => void | Promise<void>) {
        this.afterProcessed = handler;
        return this;
    }

    withProperties<Pr extends SearchIndexerProperties>(properties: Pr) {
        let indexer = new SearchIndexer<T, Pr, S>({
            name: this.name,
            version: this.version,
            index: this.index,
            stream: this.stream,
            excludedClusters: this.excludedClusters,
            includedClusters: this.includedClusters
        });
        indexer.properties = properties;
        indexer.settings = this.settings;
        return indexer;
    }

    withSettings<Settings>(settings: Settings) {
        let indexer = new SearchIndexer<T, P, Settings>({
            name: this.name,
            version: this.version,
            index: this.index,
            stream: this.stream,
            excludedClusters: this.excludedClusters,
            includedClusters: this.includedClusters,
        });
        indexer.properties = this.properties;
        indexer.settings = settings;
        return indexer;
    }

    start(handler: (args: { item: T, cursor: string | null }, ctx: Context) => Promise<{ id: string | number, doc: HandlerReturnType<P> } | null>) {
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

            updateReader('index-' + name, this.version, this.stream, async (args, ctx) => {
                if (args.first) {
                    if (await client.indices.exists({ index: this.index }) !== true) {
                        log.log(ctx, 'Creating index ' + name);
                        await client.indices.create({ index: this.index });
                    }
                    if (this.settings) {
                        try {
                            log.log(ctx, 'Updating settings of ' + name);
                            await client.indices.close({
                                index: this.index,
                            });
                            await client.indices.putSettings({
                                index: this.index,
                                body: {
                                    settings: this.settings,
                                },
                            });
                            await client.indices.open({
                                index: this.index,
                            });
                        } catch (e) {
                            if (e.body && e.body.error && e.body.error.type && e.body.error.type === 'illegal_argument_exception') {
                                log.warn(ctx, e.body);
                                log.log(ctx, 'Deleting ' + name);
                                await client.indices.delete({ index: this.index });
                            }
                            throw e;
                        }
                    }
                    if (this.properties) {
                        try {
                            log.log(ctx, 'Updating properties of ' + name);
                            await client.indices.putMapping({
                                includeTypeName: true,
                                index: this.index,
                                type: this.index,
                                body: {
                                    properties: this.properties
                                }
                            });
                        } catch (e) {
                            if (e.body && e.body.error && e.body.error.type && e.body.error.type === 'illegal_argument_exception') {
                                log.warn(ctx, e.body);
                                log.log(ctx, 'Deleting ' + name);
                                await client.indices.delete({ index: this.index });
                            }
                            throw e;
                        }
                    }
                }
                let converted: any[] = [];
                for (let i of args.items) {
                    // TODO: Reimplement
                    // log.log(ctx, this.name, 'Indexing ' + i.rawId.join('.'));
                    let c = await handler({ item: i, cursor: args.cursor }, ctx);
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
                        } else {
                            log.log(ctx, name, 'inserted', converted.length);
                        }
                    } catch (e) {
                        log.warn(ctx, e);
                        throw e;
                    }
                }
                if (this.afterProcessed && args.cursor) {
                    await this.afterProcessed(args.cursor, ctx);
                }
            }, { delay: 0 });
        }
    }
}

export function declareSearchIndexer<T>(opts: { name: string, version: number, index: string, stream: Stream<T>, excludedClusters?: string[], includedClusters?: string[] }) {
    return new SearchIndexer(opts);
}