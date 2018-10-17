import { SharedCounter } from './modules/SharedCounter';
import { Online } from './Online';
import { AllEntities } from '../schema';
import { FConnection } from 'foundation-orm/FConnection';
import { FDBConnection } from './modules/init';

export const FDB = {
    SampeCounter: new SharedCounter('sample'),
    Online: new Online()
};

export const FDB2 = new AllEntities(new FConnection(FDBConnection));