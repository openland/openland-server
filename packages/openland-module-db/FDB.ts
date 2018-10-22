import { AllEntities } from './schema';
import { FConnection } from 'foundation-orm/FConnection';

export const FDB = new AllEntities(new FConnection(FConnection.create()));