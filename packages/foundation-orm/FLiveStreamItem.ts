import { FEntity } from './FEntity';

export interface FLiveStreamItem<T extends FEntity> {
    cursor: string;
    items: T[];
}