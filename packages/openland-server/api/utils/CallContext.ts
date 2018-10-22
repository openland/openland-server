export class CallContext {
    tid?: string;
    uid?: number;
    oid?: number;
    poid?: number;
    ip?: string;
    superRope?: string | false; // actually used only over HTTP transport for enabling schema introspection for GraphiQL
    accountId: number = 0;
    cache: Map<string, any> = new Map<string, any>();
}