declare module 'airtable' {
    class Airtable {
        constructor(options: { apiKey: string })
    }

    export = Airtable;
}

declare module 'web-push' {
    export function sendNotification(subscription: any, options: any): Promise<any>;
    export function setVapidDetails(mail: string, public: string, private: string): void;
}

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

declare module '*/geo_ip_v4.json' {
    const value: [[number, number, string, string]];
    export default value;
}