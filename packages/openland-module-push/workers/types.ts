export type Push = {
    uid: number;
    title: string;
    body: string;
    picture: string | null;
    counter: number;
    conversationId: number;
    mobile: boolean;
    desktop: boolean;
    mobileAlert: boolean;
    mobileIncludeText: boolean;
    silent: boolean | null;
};

export type ApplePushTask = {
    uid: number;
    tokenId: string;
    badge?: number;
    expirity?: number;
    sound?: string;
    contentAvailable?: boolean;
    payload?: any;
    alert?: { title: string, body: string };
};

export type FirebasePushTask = {
    uid: number;
    tokenId: string;
    collapseKey?: string;
    isTest?: boolean;
    notification?: {
        title: string;
        body: string;
        sound: string;
        tag?: string;
    }
    data?: { [key: string]: string };
};

export type WebPushTask = {
    uid: number;
    tokenId: string;
    title: string;
    body: string;
    picture?: string;
    extras?: any;
};