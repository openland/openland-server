export type Push = {
    uid: number;
    title: string;
    body: string;
    picture: string | null;
    counter: number | null;
    conversationId: number | null;
    deepLink: string | null;
    mobile: boolean;
    desktop: boolean;
    mobileAlert: boolean;
    mobileIncludeText: boolean;
    silent: boolean | null;
    messageId: string | null;
    commentId: string | null;
};

export type ApplePushTask = {
    uid: number;
    tokenId: string;
    isData?: boolean;
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
    isData?: boolean;
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