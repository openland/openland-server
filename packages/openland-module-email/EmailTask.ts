export interface EmailTask {
    templateId: string;
    to: string;
    subject: string;
    args: { [key: string]: string; };
}