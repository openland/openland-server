interface NestedObject {
    [key: string]: NestedObject | any;
}

export interface EmailTask {
    templateId: string;
    to: string;
    subject: string;
    args?: { [key: string]: string; };
    dynamicTemplateData?: NestedObject;
}