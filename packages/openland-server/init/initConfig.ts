import fs from 'fs';
import WebPush from 'web-push';

class AppConfig {
    webPush: { private: string, public: string } | undefined;
    apple: { teamId: string, key: string, keyId: string, bundles: string[] }[] | undefined;
    google: { privateKey: string, projectId: string, clientEmail: string, databaseURL: string, packages: string[] }[] | undefined;
}

export const AppConfiuguration = new AppConfig();

interface CertsConfig {
    'web-push': {
        private: string,
        public: string;
    } | undefined | null;
    'apple': {
        teams: {
            key: string;
            'key-id': string;
            'team-id': string;
            bundles: string[];
        }[] | undefined | null
    } | undefined | null;
    'google': {
        accounts: {
            key: {
                type: string
                project_id: string
                private_key_id: string
                private_key: string
                client_email: string
                client_id: string
                auth_uri: string
                token_uri: string
                auth_provider_x509_cert_url: string
                client_x509_cert_url: string
            },
            endpoint: string,
            packages: string[]
        }[] | undefined | null;
    } | undefined | null;
}

if (process.env.PUSH_CERTS_PATH) {
    let config = JSON.parse(fs.readFileSync(process.env.PUSH_CERTS_PATH, 'utf-8')) as CertsConfig;

    // Loading Web Push
    if (config['web-push']) {
        AppConfiuguration.webPush = { private: config['web-push']!!.private, public: config['web-push']!!.public };
        WebPush.setVapidDetails(
            'mailto:support@openland.com',
            AppConfiuguration.webPush.public,
            AppConfiuguration.webPush.private
        );
    }
    if (config.apple && config.apple.teams && config.apple.teams.length > 0) {
        let t = config.apple!!.teams!!;
        AppConfiuguration.apple = t.map((v) => ({ teamId: v['team-id'], keyId: v['key-id'], key: v.key, bundles: v.bundles }));
    }

    if (config.google && config.google.accounts) {
        AppConfiuguration.google = config.google.accounts.map(a => ({ privateKey: a.key.private_key, projectId: a.key.project_id, clientEmail: a.key.client_email, databaseURL: a.endpoint, packages: a.packages }));
    }
}