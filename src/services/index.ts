import { NYCProperties } from './NYCProperties';
import { NYCBISWEB } from './NYCBISWEB';
import { Files } from './Files';
import UrlInfoService from './UrlInfoService';
import { BoxPreviews } from './BoxPreviews';
import { UploadCare } from './UploadCare';

export const Services = {
    NYCProperties: new NYCProperties(),
    NYCBisWeb: new NYCBISWEB(),
    Files: Files,
    URLInfo: new UrlInfoService(),
    BoxPreview: new BoxPreviews(),
    UploadCare: new UploadCare()
};