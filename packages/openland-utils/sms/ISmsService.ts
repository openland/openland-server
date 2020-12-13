import { Context } from '@openland/context';

export interface ISmsService {
    sendSms(сtx: Context, to: string, body: string): Promise<boolean>;
}