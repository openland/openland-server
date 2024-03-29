import { ImageRef } from 'openland-module-media/ImageRef';

export interface OrganizatinProfileInput {
    id?: string | null | undefined;
    name?: string | null | undefined;
    website?: string | null | undefined;
    personal?: boolean | null | undefined;
    photoRef?: ImageRef | null | undefined;
    socialImageRef?: ImageRef | null | undefined;
    about?: string | null | undefined;
    isCommunity?: boolean | null | undefined;
    isPrivate?: boolean | null | undefined;
    membersCanInvite?: boolean | null | undefined;
    applyLink?: string | null;
    applyLinkEnabled?: boolean | null;
    autosubscribeRooms?: number[] | null;
}