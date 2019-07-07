import { container } from 'openland-modules/Modules.container';
import { Store as SStore } from './store';

export const Store = new Proxy({}, {
    get: function (obj: {}, prop: string | number | symbol) {
        return (container.get('Store') as any)[prop];
    }
}) as SStore;