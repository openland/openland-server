import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { SchemaLink } from 'apollo-link-schema';
import { Schema } from '../../schema';
import { CallContext } from '../../api/utils/CallContext';

export function createApiClient(args?: { uid?: number, oid?: number }) {
    let context = new CallContext();
    context.uid = args && args.uid ? args.uid : undefined;
    context.oid = args && args.oid ? args.oid : undefined;
    return new ApolloClient({
        ssrMode: true,
        cache: new InMemoryCache(),
        link: new SchemaLink({ schema: Schema, context }),
        defaultOptions: {
            query: {
                fetchPolicy: 'network-only',
                errorPolicy: 'all'
            },
            watchQuery: {
                fetchPolicy: 'network-only',
                errorPolicy: 'all'
            }
        }
    });
}