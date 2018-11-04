import {
    GraphQLSchema,
    GraphQLObjectType,
    GraphQLString,
    GraphQLFloat,
    GraphQLBoolean,
    GraphQLList,
    GraphQLInt,
    GraphQLNonNull,
    GraphQLInputObjectType
} from 'graphql';
import * as Case from 'change-case';

import { AllEntities } from './schema';
import { FDB } from './FDB';
import { FEntitySchema, FEntitySchemaIndex } from 'foundation-orm/FEntitySchema';
import { inTx } from 'foundation-orm/inTx';
import { delay } from 'openland-server/utils/timer';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';

let entitiesMap: any = {};
let queries: any = {};
let mutations: any = {};
let subscriptions: any = {};

subscriptions.healthCheck = {
    type: GraphQLString,
    subscribe: async function* func() {
        while (true) {
            yield Date.now();
            await delay(1000);
        }
    },
    resolve(v: any) {
        return v;
    }
};

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
    let inputFields: any = {};
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
            inputFields[f.name] = {
                type: buildType(f.type)
            };
        }
    }
    let obj = new GraphQLObjectType({
        name: e.name,
        fields: { ...fields, rawValue: { type: GraphQLString } }
    });
    entitiesMap[e.name] = obj;

    let objConnection = new GraphQLObjectType({
        name: e.name + 'Connection',
        fields: {
            items: { type: new GraphQLList(obj) },
            cursor: { type: GraphQLString }
        }
    });
    entitiesMap[e.name + 'Connection'] = objConnection;
    let objInput = new GraphQLInputObjectType({
        name: e.name + 'InputType',
        fields: inputFields
    });
    entitiesMap[e.name + 'InputType'] = objInput;

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

    //
    // Watch
    //

    subscriptions[Case.camelCase(e.name)] = {
        type: obj,
        args: args,
        subscribe: async function* func(_: any, a: any) {
            while (true) {
                let ids: any[] = [];
                for (let f of e.primaryKeys) {
                    ids.push(a[f.name]);
                }
                yield (FDB as any)[e.name].findById(...ids);
                await delay(1000);
            }
        },
        resolve(v: any) {
            return v;
        }
    };

    // Load all query
    queries[Case.camelCase(e.name) + 'All'] = {
        type: new GraphQLList(obj),
        resolve() {
            return (FDB as any)[e.name].findAll();
        }
    };

    // Indexes
    for (let i of e.indexes) {
        if (i.displayName) {
            if (i.type === 'unique') {
                queries[i.displayName] = {
                    type: obj,
                    args: {
                        ...buildArguments(e, i, 0),
                    },
                    resolve: async (_: any, arg: any) => {
                        let argm = extractArguments(arg, e, i, 0);
                        let res = await (FDB as any)[e.name]['findFrom' + Case.pascalCase(i.name)](...argm, arg.first, arg.after, arg.reversed);
                        return {
                            ...res._value,
                            rawValue: res._value
                        };
                    }
                };
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
                    type: objConnection,
                    args: {
                        ...buildArguments(e, i, 1),
                        first: {
                            type: new GraphQLNonNull(GraphQLInt)
                        },
                        after: {
                            type: GraphQLString
                        },
                        reversed: {
                            type: GraphQLBoolean
                        }
                    },
                    resolve: async (_: any, arg: any) => {
                        let argm = extractArguments(arg, e, i, 1);
                        let res = await (FDB as any)[e.name]['rangeFrom' + Case.pascalCase(i.name) + 'WithCursor'](...argm, arg.first, arg.after, arg.reversed);
                        return {
                            ...res._value,
                            rawValue: res._value
                        };
                    }
                };
            }
        }
    }

    // Creation
    if (e.editable) {
        mutations[Case.camelCase(e.name) + 'Create'] = {
            type: obj,
            args: { ...args, input: { type: objInput } },
            resolve(_: any, a: any) {
                let ids: any[] = [];
                for (let f of e.primaryKeys) {
                    ids.push(a[f.name]);
                }
                return inTx(async () => {
                    return await (FDB as any)[e.name].create(...ids, a.input);
                });
            }
        };

        mutations[Case.camelCase(e.name) + 'Update'] = {
            type: obj,
            args: { ...args, input: { type: objInput } },
            resolve(_: any, a: any) {
                let ids: any[] = [];
                for (let f of e.primaryKeys) {
                    ids.push(a[f.name]);
                }
                return inTx(async () => {
                    let item = await (FDB as any)[e.name].findById(...ids);
                    if (!item) {
                        throw Error('Not found');
                    }

                    for (let f of e.fields) {
                        if (a.input[f.name] !== undefined) {
                            item[f.name] = a.input[f.name];
                        }
                    }

                    return item;
                });
            }
        };
    }
}

queries.metaAllDirectories = {
    type: new GraphQLList(new GraphQLObjectType({
        name: 'MetaDirectoryConnection',
        fields: {
            key: { type: GraphQLString },
            id: { type: GraphQLString }
        }
    })),
    resolve(_: any, a: any) {
        return FDB.connection.findAllDirectories();
    }
};

queries.metaMigrations = {
    type: new GraphQLList(GraphQLString),
    async resolve() {
        return (await FDB.connection.fdb.getRangeAll(FKeyEncoding.encodeKey(['__meta', 'migrations']))).map((v) => (v[1] as any).key);
    }
};

var schema = new GraphQLSchema({
    query: new GraphQLObjectType({
        name: 'RootQueryType',
        fields: queries
    }),
    mutation: new GraphQLObjectType({
        name: 'RootMutationType',
        fields: mutations
    }),
    subscription: new GraphQLObjectType({
        name: 'RootSubsctiptionType',
        fields: subscriptions
    })
});

export const FDBGraphqlSchema = schema;