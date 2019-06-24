import { AllEntities } from './schema';
import { container } from 'openland-modules/Modules.container';

export const FDB = new Proxy({}, {
    get: function (obj: {}, prop: string | number | symbol) {
        return (container.get('FDB') as any)[prop];
    }
}) as AllEntities;