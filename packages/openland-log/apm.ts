import { Config } from 'openland-config/Config';
import APM from 'elastic-apm-node';

export const apm = APM.start({
    serviceName: 'global',
    serverUrl: Config.apm?.endpoint || '',
    active: Config.environment === 'production',
    instrument: false,
    instrumentIncomingHTTPRequests: false
});