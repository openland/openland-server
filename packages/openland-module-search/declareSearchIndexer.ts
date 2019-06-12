import { FStream } from 'foundation-orm/FStream';
import { FEntity } from 'foundation-orm/FEntity';
import { updateReader } from 'openland-module-workers/updateReader';
import { Modules } from 'openland-modules/Modules';
import { Context } from '@openland/context';
import { createLogger } from '@openland/log';

const log = createLogger('elastic-indexer');

export class SearchIndexer<T extends FEntity> {
    readonly name: string;
    readonly version: number;
    readonly index: string;
    readonly stream: FStream<T>;
    readonly client = Modules.Search.elastic.client;
    properties?: any;

    constructor(name: string, version: number, index: string, stream: FStream<T>) {
        this.name = name;
        this.version = version;
        this.index = index;
        this.stream = stream;
    }

    withProperties(properties: any) {
        this.properties = properties;
        return this;
    }

    start(handler: (item: T, ctx: Context) => Promise<{ id: string | number, doc: any } | null>) {
        if (!Modules.Search.elastic.isWritable) {
            return;
        }
        updateReader('index-' + this.name, this.version, this.stream, async (items, first, ctx) => {
            if (first) {
                if (await this.client.indices.exists({ index: this.index }) !== true) {
                    await this.client.indices.create({ index: this.index });
                }
                if (this.properties) {
                    try {
                        await this.client.indices.putMapping({
                            index: this.index, type: this.index, body: {
                                properties: this.properties
                            }
                        });
                    } catch (e) {
                        if (e.body && e.body.error && e.body.error.type && e.body.error.type === 'illegal_argument_exception') {
                            await this.client.indices.delete({ index: this.index });
                        }
                        throw e;
                    }
                }
            }
            let converted: any[] = [];
            for (let i of items) {
                log.log(ctx, this.name, 'Indexing ' + i.rawId.join('.'));
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
                        log.warn(ctx, res);
                        throw new Error('Error during indexing (' + this.name + ')');
                    }
                } catch (e) {
                    log.warn(ctx, e);
                    throw e;
                }
            }
        }, { delay: 5000 });
    }
}

export function declareSearchIndexer<T extends FEntity>(name: string, version: number, index: string, stream: FStream<T>) {
    return new SearchIndexer(name, version, index, stream);
}