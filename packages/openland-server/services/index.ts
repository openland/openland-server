import { Files } from './Files';
import UrlInfoService from './UrlInfoService';
import { BoxPreviews } from './BoxPreviews';
import { UploadCare } from './UploadCare';
import { TeleSign } from './TeleSign';

export const Services = {
    Files: Files,
    URLInfo: new UrlInfoService(),
    BoxPreview: new BoxPreviews(),
    UploadCare: new UploadCare(),
    TeleSign: new TeleSign()
};