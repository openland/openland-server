import { ImageRef } from 'openland-module-media/ImageRef';

export interface OrganizatinProfileInput {
    name?: string | null | undefined;
    website?: string | null | undefined;
    personal?: boolean | null | undefined;
    photoRef?: ImageRef | null | undefined;
    about?: string | null | undefined;
    isCommunity?: boolean | null | undefined;
}