import fs from 'fs';
import WebPush from 'web-push';

class AppConfig {
    webPush: { private: string, public: string } | undefined;
    apple: { teamId: string, key: string, keyId: string, bundles: string[] }[] | undefined;
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
}