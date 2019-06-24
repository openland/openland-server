import { AllEntities } from './schema';
import { container } from 'openland-modules/Modules.container';
import { Store as SStore } from './store';

export const FDB = new Proxy({}, {
    get: function (obj: {}, prop: string | number | symbol) {
        return (container.get('FDB') as any)[prop];
    }
}) as AllEntities;

export const Store = new Proxy({}, {
    get: function (obj: {}, prop: string | number | symbol) {
        return (container.get('Store') as any)[prop];
    }
}) as SStore;