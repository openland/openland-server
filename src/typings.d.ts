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
    export default class TeleSignSDK {
        constructor(customerId: string, apiKey: string, restEndpoint: string, timeout?: number)
    }
}