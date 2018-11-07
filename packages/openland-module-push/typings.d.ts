declare module 'web-push' {
    export function sendNotification(subscription: any, options: any): Promise<{ statusCode: number, body: string, headers: any }>;
    export function setVapidDetails(mail: string, public: string, private: string): void;
}