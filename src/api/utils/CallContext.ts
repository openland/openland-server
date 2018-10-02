export class CallContext {
    tid?: number;
    uid?: number;
    oid?: number;
    poid?: number;
    superRope?: string | false; // actually used only over HTTP transport for enabling schema introspection for GraphiQL
    accountId: number = 0;
    cache: Map<string, any> = new Map<string, any>();
}