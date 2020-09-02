type CallSettings = {
    mode: 'standard' | 'disabled' | 'link',
    callLink?: string
};
type ServiceMessageSettings = {
    joinsMessageEnabled: boolean,
    leavesMessageEnabled: boolean
};

export interface RoomProfileInput {
    title: string;
    image?: any | null;
    description?: string | null;
    socialImage?: any | null;
    kind?: 'internal' | 'public' | 'group' | null;
    repliesEnabled?: boolean | null;
    callSettings?: CallSettings | null;
    serviceMessageSettings?: ServiceMessageSettings | null;
}