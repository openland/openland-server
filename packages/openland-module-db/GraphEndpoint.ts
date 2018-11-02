import {
    GraphQLSchema,
    GraphQLObjectType,
    GraphQLString,
    GraphQLNamedType
} from 'graphql';

import { AllEntities } from './schema';

let entites: GraphQLNamedType[] = [];

for (let e of AllEntities.schema) {
    entites.push(new GraphQLObjectType({
        name: e.name,
        fields: {
            hello: {
                type: GraphQLString,
                resolve() {
                    return 'world';
                }
            }
        }
    }));
}

var schema = new GraphQLSchema({
    query: new GraphQLObjectType({
        name: 'RootQueryType',
        fields: {
            hello: {
                type: GraphQLString,
                resolve() {
                    return 'world';
                }
            }
        }
    }),
});

export const FDBSchema = schema;