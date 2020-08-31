export interface RoomProfileInput {
    title: string;
    image?: any | null;
    description?: string | null;
    socialImage?: any | null;
    kind?: 'internal' | 'public' | 'group' | null;
    repliesEnabled?: boolean | null;
}