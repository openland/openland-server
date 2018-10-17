import { SharedCounter } from './modules/SharedCounter';
import { Online } from './Online';

export const FDB = {
    SampeCounter: new SharedCounter('sample'),
    Online: new Online()
};