import { AllEntities, AllEntitiesProxy } from './schema';
import { container } from 'openland-modules/Modules.container';

export const FDB = new AllEntitiesProxy(() => container.get('FDB')) as AllEntities;