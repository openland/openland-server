import { AllEntities } from '../schema';
import { FConnection } from 'foundation-orm/FConnection';
import { FDBConnection } from './modules/init';

export const FDB = new AllEntities(new FConnection(FDBConnection));