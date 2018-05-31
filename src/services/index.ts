import { NYCProperties } from './NYCProperties';
import { NYCBISWEB } from './NYCBISWEB';
import { Files } from './Files';

export const Services = {
    NYCProperties: new NYCProperties(),
    NYCBisWeb: new NYCBISWEB(),
    Files: Files
};