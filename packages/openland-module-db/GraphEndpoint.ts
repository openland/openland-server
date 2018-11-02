import {
    GraphQLSchema,
    GraphQLObjectType,
    GraphQLString,
    GraphQLFloat,
    GraphQLBoolean,
    GraphQLList
} from 'graphql';
import * as Case from 'change-case';

import { AllEntities } from './schema';
import { FDB } from './FDB';
import { FEntitySchema, FEntitySchemaIndex } from 'foundation-orm/FEntitySchema';

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

function buildArguments(entiy: FEntitySchema, index: FEntitySchemaIndex, padding: number) {
    let args2: any = {};
    for (let i = 0; i < index.fields.length - padding; i++) {
        let a = index.fields[i];
        for (let f of entiy.primaryKeys) {
            if (a === f.name) {
                args2[f.name] = {
                    type: buildType(f.type)
                };
                break;
            }
        }
        for (let f of entiy.fields) {
            if (a === f.name) {
                args2[f.name] = {
                    type: buildType(f.type)
                };
            }
        }
    }
    return args2;
}

function extractArguments(src: any, entiy: FEntitySchema, index: FEntitySchemaIndex, padding: number) {
    let res: any[] = [];
    for (let i = 0; i < index.fields.length - padding; i++) {
        let a = index.fields[i];
        for (let f of entiy.primaryKeys) {
            if (a === f.name) {
                res.push(src[f.name]);
                break;
            }
        }
        for (let f of entiy.fields) {
            if (a === f.name) {
                res.push(src[f.name]);
            }
        }
    }
    return res;
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

    // Primary Key query
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

    // Load all query
    queries[Case.camelCase(e.name) + 'All'] = {
        type: new GraphQLList(obj),
        resolve() {
            return (FDB as any)[e.name].findAll();
        }
    };

    for (let i of e.indexes) {
        if (i.displayName) {
            if (i.type === 'unique') {
                // queries[i.displayName] = {
                //     type: new GraphQLList(obj),
                //     args: buildArguments(e, i, 0),
                //     resolve(_: any, arg: any) {
                //         return (FDB as any)[e.name]['rangeFrom' + i.name + 'WithCursor'](...extractArguments(arg, e, i, 0));
                //     }
                // };

                // Nothing To do
            } else if (i.type === 'range') {
                queries[i.displayName] = {
                    type: new GraphQLList(obj),
                    args: buildArguments(e, i, 1),
                    resolve: async (_: any, arg: any) => {
                        let argm = extractArguments(arg, e, i, 1);
                        console.log(argm);
                        let res = await (FDB as any)[e.name]['rangeFrom' + Case.pascalCase(i.name) + 'WithCursor'](...argm, 20);
                        return res.items;
                    }
                };
            }
        }
    }
}

var schema = new GraphQLSchema({
    query: new GraphQLObjectType({
        name: 'RootQueryType',
        fields: queries
    }),
});

export const FDBGraphqlSchema = schema;