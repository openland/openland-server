import { AllEntities } from './schema';
import { FConnection } from 'foundation-orm/FConnection';
import { EventBus } from 'openland-module-pubsub/EventBus';

export const FDB = new AllEntities(new FConnection(FConnection.create(), EventBus));