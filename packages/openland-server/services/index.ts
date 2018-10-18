import { Files } from './Files';
import UrlInfoService from './UrlInfoService';
import { UploadCare } from './UploadCare';
import { TeleSign } from './TeleSign';

export const Services = {
    Files: Files,
    URLInfo: new UrlInfoService(),
    UploadCare: new UploadCare(),
    TeleSign: new TeleSign()
};