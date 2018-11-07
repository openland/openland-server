declare module 'telesignsdk' {
    class MessagingClient {
        message(cb: (err: any, response: any) => void, phoneNumber: string, message: string, messageType: 'ARN'|'OTP'|'MKT'): void;
        status(cb: (err: any, response: any) => void, referenceId: string): void;
    }

    export default class TeleSignSDK {
        public sms: MessagingClient;

        constructor(customerId: string, apiKey: string, restEndpoint: string, timeout?: number)
    }
}