import { FEntity } from './FEntity';

export interface FStreamItem<T extends FEntity> {
    value: T;
    cursor: string;
}