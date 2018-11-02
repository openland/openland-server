import {
    GraphQLSchema,
    GraphQLObjectType,
    GraphQLString,
    GraphQLFloat,
    GraphQLBoolean
} from 'graphql';
import * as Case from 'change-case';

import { AllEntities } from './schema';
import { FDB } from './FDB';

let entitiesMap: any = {};
let queries: any = {};

function buildType(src: 'string' | 'number' | 'json' | 'boolean' | 'enum') {
    if (src === 'string') {
        return GraphQLString;
    } else if (src === 'number') {
        return GraphQLFloat;
    } else if (src === 'json') {
        return GraphQLString;
    } else if (src === 'boolean') {
        return GraphQLBoolean;
    } else if (src === 'enum') {
        return GraphQLString;
    } else {
        throw Error('Unsupported type: ' + src);
    }
}

for (let e of AllEntities.schema) {
    let fields: any = {};
    let args: any = {};
    for (let f of e.primaryKeys) {
        fields[f.name] = {
            type: buildType(f.type)
        };
        args[f.name] = {
            type: buildType(f.type)
        };
    }
    for (let f of e.fields) {
        if (!f.secure) {
            fields[f.name] = {
                type: buildType(f.type)
            };
        }
    }
    let obj = new GraphQLObjectType({
        name: e.name,
        fields: fields
    });
    entitiesMap[e.name] = obj;
    // entites.push(obj);
    queries[Case.camelCase(e.name)] = {
        type: obj,
        args: args,
        resolve(_: any, a: any) {
            let ids: any[] = [];
            for (let f of e.primaryKeys) {
                ids.push(a[f.name]);
            }
            return (FDB as any)[e.name].findById(...ids);
        }
    };
}

var schema = new GraphQLSchema({
    query: new GraphQLObjectType({
        name: 'RootQueryType',
        fields: queries
    }),
});

export const FDBGraphqlSchema = schema;