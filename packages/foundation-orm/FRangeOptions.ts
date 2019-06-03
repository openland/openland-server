export interface FRangeOptions<K = Buffer> {
    after?: K;
    limit?: number;
    reverse?: boolean;
}