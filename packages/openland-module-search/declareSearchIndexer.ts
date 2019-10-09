import { updateReader } from 'openland-module-workers/updateReader';
import { Modules } from 'openland-modules/Modules';
import { Context } from '@openland/context';
import { createLogger } from '@openland/log';
import { Stream } from '@openland/foundationdb-entity/lib/Stream';

const log = createLogger('elastic-indexer');

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
    readonly client = Modules.Search.elastic.client;
    properties?: SearchIndexerProperties;

    constructor(name: string, version: number, index: string, stream: Stream<T>) {
        this.name = name;
        this.version = version;
        this.index = index;
        this.stream = stream;
    }

    withProperties<Pr extends SearchIndexerProperties>(properties: Pr) {
        let indexer = new SearchIndexer<T, Pr>(this.name, this.version, this.index, this.stream);
        indexer.properties = properties;
        return indexer;
    }

    start(handler: (item: T, ctx: Context) => Promise<{ id: string | number, doc: HandlerReturnType<P> } | null>) {
        if (!Modules.Search.elastic.isWritable) {
            return;
        }
        updateReader('index-' + this.name, this.version, this.stream, async (items, first, ctx) => {
            if (first) {
                if (await this.client.indices.exists({ index: this.index }) !== true) {
                    log.log(ctx, 'Creating index ' + this.name);
                    await this.client.indices.create({ index: this.index });
                }
                if (this.properties) {
                    try {
                        log.log(ctx, 'Updating properties of ' + this.name);
                        await this.client.indices.putMapping({
                            index: this.index, type: this.index, body: {
                                properties: this.properties
                            }
                        });
                    } catch (e) {
                        if (e.body && e.body.error && e.body.error.type && e.body.error.type === 'illegal_argument_exception') {
                            log.log(ctx, 'Deleting ' + this.name);
                            await this.client.indices.delete({ index: this.index });
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
                    let res = await Modules.Search.elastic.client.bulk({
                        body: converted,
                    });
                    if (res.errors) {
                        log.warn(ctx, 'Elastic error', JSON.stringify(res), JSON.stringify(converted));
                        throw new Error('Error during indexing (' + this.name + ')');
                    }
                } catch (e) {
                    log.warn(ctx, e);
                    throw e;
                }
            }
        }, { delay: 0 });
    }
}

export function declareSearchIndexer<T>(name: string, version: number, index: string, stream: Stream<T>) {
    return new SearchIndexer(name, version, index, stream);
}