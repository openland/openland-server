import { FStream } from 'foundation-orm/FStream';
import { FEntity } from 'foundation-orm/FEntity';
import { updateReader } from 'openland-module-workers/updateReader';
import { Modules } from 'openland-modules/Modules';
import { createLogger } from 'openland-log/createLogger';
import { createEmptyContext } from 'openland-utils/Context';

const log = createLogger('indexer');

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

    start(handler: (item: T) => Promise<{ id: string | number, doc: any } | null>) {
        if (!Modules.Search.elastic.isWritable) {
            return;
        }
        updateReader('index-' + this.name, this.version, this.stream, async (items, first) => {
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
            let ctx = createEmptyContext();
            let converted: any[] = [];
            for (let i of items) {
                log.log(ctx, 'Indexing ' + i.rawId.join('.'));
                let c = await handler(i);
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
                        log.warn(ctx, JSON.stringify(res));
                        throw new Error('Error during indexing');
                    }
                } catch (e) {
                    log.warn(e);
                    throw e;
                }
            }
        }, { delay: 5000 });
    }
}

export function declareSearchIndexer<T extends FEntity>(name: string, version: number, index: string, stream: FStream<T>) {
    return new SearchIndexer(name, version, index, stream);
}