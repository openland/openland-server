import * as t from 'io-ts';
import fs from 'fs';
import { isRight } from 'fp-ts/lib/Either';
import { PathReporter } from 'io-ts/lib/PathReporter';
import os from 'os';
const hostname = os.hostname();

const codec = t.type({
    app: t.type({
        environment: t.union([t.literal('production'), t.literal('staging'), t.literal('debug'), t.literal('test')]),
        authenticationSalt: t.string
    }),
    twillio: t.type({
        sid: t.string,
        token: t.string
    }),
    foundationdb: t.union([t.type({
        cluster: t.string,
        dcid: t.string
    }), t.null]),
    nats: t.union([t.type({
        endpoints: t.array(t.string)
    }), t.null]),
    elasticsearch: t.type({
        primary: t.string,
        clusters: t.array(t.type({
            name: t.string,
            version: t.union([t.string, t.undefined, t.null]),
            endpoint: t.string,
            writable: t.union([t.boolean, t.undefined, t.null])
        }))
    }),
    apm: t.union([t.type({
        endpoint: t.string
    }), t.null, t.undefined]),
    stripe: t.type({
        public: t.string,
        secret: t.string
    }),
    clickhouse: t.type({
        endpoint: t.string,
        database: t.string,
        user: t.string,
        password: t.string
    }),
    redis: t.union([t.type({
        endpoint: t.string
    }), t.null, t.undefined]),

    pushWeb: t.union([
        t.type({
            private: t.string,
            public: t.string
        }),
        t.undefined,
        t.null
    ]),
    pushApple: t.union([
        t.type({
            teams: t.array(t.type({
                key: t.string,
                keyId: t.string,
                teamId: t.string,
                bundles: t.array(t.string)
            }))
        }),
        t.undefined,
        t.null
    ]),
    pushGoogle: t.union([
        t.type({
            accounts: t.array(t.type({
                key: t.type({
                    type: t.string,
                    project_id: t.string,
                    private_key_id: t.string,
                    private_key: t.string,
                    client_email: t.string,
                    client_id: t.string,
                    auth_uri: t.string,
                    token_uri: t.string,
                    auth_provider_x509_cert_url: t.string,
                    client_x509_cert_url: t.string
                }),
                endpoint: t.string,
                packages: t.array(t.string)
            }))
        }),
        t.undefined,
        t.null
    ]),
    screenshotter: t.union([
        t.type({
            endpoint: t.string
        }),
        t.null,
        t.undefined
    ])
});

let configuration: t.TypeOf<typeof codec> | undefined = undefined;
let enableTracing: boolean = false;

function loadConfigIfNeeded() {
    if (configuration) {
        return;
    }
    let configPath = process.env.OPENLAND_CONFIG;
    if (!configPath) {
        throw Error('Config path not provided');
    }
    let res = fs.readFileSync(configPath, { encoding: 'utf8' });
    let parsed = JSON.parse(res);
    let decoded = codec.decode(parsed);
    if (isRight(decoded)) {
        configuration = decoded.right;
    } else {
        throw Error('Error in config: ' + JSON.stringify(PathReporter.report(decoded)));
    }

    if ((process.env.JAEGER_AGENT_HOST || process.env.JAEGER_ENDPOINT) && (process.env.JAEGER_DISABLE !== 'true')) {
        enableTracing = true;
    }
}

class ConfigProvider {
    constructor() {
        Object.freeze(this);
    }

    get environment() {
        loadConfigIfNeeded();
        return configuration!.app.environment;
    }

    get authenticationSalt() {
        loadConfigIfNeeded();
        return configuration!.app.authenticationSalt;
    }

    get twillio() {
        loadConfigIfNeeded();
        return configuration!.twillio;
    }

    get foundationdb() {
        loadConfigIfNeeded();
        return configuration!.foundationdb;
    }

    get nats() {
        loadConfigIfNeeded();
        return configuration!.nats;
    }

    get elasticsearch() {
        loadConfigIfNeeded();
        return configuration!.elasticsearch;
    }

    get stripe() {
        loadConfigIfNeeded();
        return configuration!.stripe;
    }

    get clickhouse() {
        loadConfigIfNeeded();
        return configuration!.clickhouse;
    }

    get enableTracing() {
        return enableTracing;
    }

    get apm() {
        loadConfigIfNeeded();
        if (configuration!.apm) {
            return configuration!.apm!;
        } else {
            return null;
        }
    }

    get redis() {
        loadConfigIfNeeded();
        if (configuration!.redis) {
            return configuration!.redis;
        } else {
            return null;
        }
    }

    get pushWeb() {
        loadConfigIfNeeded();
        if (configuration!.pushWeb) {
            return configuration!.pushWeb;
        } else {
            return null;
        }
    }

    get pushApple() {
        loadConfigIfNeeded();
        if (configuration!.pushApple) {
            return configuration!.pushApple;
        } else {
            return null;
        }
    }

    get pushGoogle() {
        loadConfigIfNeeded();
        if (configuration!.pushGoogle) {
            return configuration!.pushGoogle;
        } else {
            return null;
        }
    }

    get screenshotter() {
        loadConfigIfNeeded();
        if (configuration!.screenshotter) {
            return configuration!.screenshotter.endpoint;
        } else {
            return 'https://links.openlandservers.com';
        }
    }

    get hostname() {
        return hostname;
    }
}

export const Config = new ConfigProvider();