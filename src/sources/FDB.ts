import { SharedCounter } from './SharedCounter';
import { Online } from './Online';

export const FDB = {
    SampeCounter: new SharedCounter('sample'),
    Online: new Online()
};