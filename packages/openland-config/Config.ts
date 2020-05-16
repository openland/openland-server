import * as t from 'io-ts';
import fs from 'fs';
import { isRight } from 'fp-ts/lib/Either';

const codec = t.type({
    app: t.type({
        environment: t.union([t.literal('production'), t.literal('staging'), t.literal('debug'), t.literal('testing')]),
        authenticationSalt: t.string
    }),
    twillio: t.type({
        sid: t.string,
        token: t.string
    }),
    foundationdb: t.type({
        cluster: t.string,
        dcid: t.string
    }),
    nats: t.type({
        endpoints: t.array(t.string)
    }),
    elasticsearch: t.type({
        endpoint: t.string
    }),
    stripe: t.type({
        public: t.string,
        secret: t.string
    }),
    clickhouse: t.type({
        endpoint: t.string,
        database: t.string,
        user: t.string,
        password: t.string
    })
});

let configuration: t.TypeOf<typeof codec> | undefined = undefined;

class ConfigProvider {
    constructor() {
        Object.freeze(this);
    }

    get environment() {
        if (!configuration) {
            throw Error('Configuration is not loaded');
        }
        return configuration.app.environment;
    }

    get authenticationSalt() {
        if (!configuration) {
            throw Error('Configuration is not loaded');
        }
        return configuration.app.authenticationSalt;
    }

    get twillio() {
        if (!configuration) {
            throw Error('Configuration is not loaded');
        }
        return configuration.twillio;
    }

    get foundationdb() {
        if (!configuration) {
            throw Error('Configuration is not loaded');
        }
        return configuration.foundationdb;
    }

    get nats() {
        if (!configuration) {
            throw Error('Configuration is not loaded');
        }
        return configuration.nats;
    }

    get elasticsearch() {
        if (!configuration) {
            throw Error('Configuration is not loaded');
        }
        return configuration.elasticsearch;
    }

    get stripe() {
        if (!configuration) {
            throw Error('Configuration is not loaded');
        }
        return configuration.stripe;
    }

    get clickhouse() {
        if (!configuration) {
            throw Error('Configuration is not loaded');
        }
        return configuration.clickhouse;
    }
}

export const Config = new ConfigProvider();

export function loadConfig(path: string) {
    if (configuration) {
        throw Error('Configuration already loaded');
    }
    let res = fs.readFileSync(path, { encoding: 'utf8' });
    let parsed = JSON.parse(res);
    let decoded = codec.decode(parsed);
    if (isRight(decoded)) {
        configuration = decoded.right;
    } else {
        throw Error('Error in config: ' + decoded.left);
    }
}