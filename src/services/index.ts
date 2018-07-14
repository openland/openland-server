import { NYCProperties } from './NYCProperties';
import { NYCBISWEB } from './NYCBISWEB';
import { Files } from './Files';
import UrlInfoService from './UrlInfoService';

export const Services = {
    NYCProperties: new NYCProperties(),
    NYCBisWeb: new NYCBISWEB(),
    Files: Files,
    URLInfo: new UrlInfoService()
};