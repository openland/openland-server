import fs from 'fs';
import WebPush from 'web-push';

class AppConfig {
    webPush: { private: string, public: string } | undefined;
}

export const AppConfiuguration = new AppConfig();

interface CertsConfig {
    'web-push': {
        private: string,
        public: string;
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
}