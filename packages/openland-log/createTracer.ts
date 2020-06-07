import { apm } from './apm';
// import APM from 'elastic-apm-node';
import { Config } from 'openland-config/Config';
import { STracer } from './STracer';
import { OpenTracer } from './src/OpenTracer';
import { NoOpTracer } from './src/NoOpTracer';
const Tracer = require('elastic-apm-node-opentracing');

export function createTracer(name: string): STracer {
    if (Config.environment === 'production' && Config.enableTracing && Config.apm) {
        // const apm = APM.start({
        //     serviceName: name,
        //     serverUrl: Config.apm.endpoint,
        //     active: true,
        //     instrument: false
        // });
        return new OpenTracer(new Tracer(apm));
    } else {
        return new NoOpTracer();
    }
}