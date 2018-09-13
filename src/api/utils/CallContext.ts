export class CallContext {
    tid?: number;
    uid?: number;
    oid?: number;
    poid?: number;
    accountId: number = 0;
    cache: Map<string, any> = new Map<string, any>();
}