export class CallContext {
    uid?: number;
    oid?: number;
    accountId: number = 0;
    cache: Map<string, any> = new Map<string, any>();
}