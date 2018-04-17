export class CallContext {
    uid?: number;
    accountId: number = 0;
    cache: Map<string, any> = new Map<string, any>();
}