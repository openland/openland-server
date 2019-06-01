export interface FTransformer<T1, T2> {
    unpack(src: T1): T2;
    pack(src: T2): T1;
}