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

import { AllEntitiesDirect } from '../schema';
import { FEntitySchema, FEntitySchemaIndex } from 'foundation-orm/FEntitySchema';
import { inTx } from 'foundation-orm/inTx';
import { delay } from 'openland-utils/timer';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { IdsFactory } from 'openland-module-api/IDs';
import { FConnection } from 'foundation-orm/FConnection';
import { EventBus } from 'openland-module-pubsub/EventBus';
import { createEmptyContext } from 'openland-utils/Context';

let FDB = new AllEntitiesDirect(new FConnection(FConnection.create(), EventBus));
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

for (let e of AllEntitiesDirect.schema) {
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
                type: buildType(f.type),
                ...(f.type === 'json' ? { resolve: (entity: any) => JSON.stringify(entity[f.name]) } : {})
            };
            inputFields[f.name] = {
                type: buildType(f.type)
            };
        }
    }
    let obj = new GraphQLObjectType({
        name: e.name,
        fields: { ...fields, rawValue: { type: GraphQLString, resolve: entity => JSON.stringify(entity._value) } }
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
            return (FDB as any)[e.name].findById(createEmptyContext(), ...ids);
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
                yield (FDB as any)[e.name].findById(createEmptyContext(), ...ids);
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
            return (FDB as any)[e.name].findAll(createEmptyContext());
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
                        // let argm = extractArguments(arg, e, i, 0);
                        let res = await (FDB as any)[e.name]['rangeFrom' + Case.pascalCase(i.name) + 'WithCursor'](createEmptyContext(), arg.first, arg.after, arg.reversed);
                        console.log(res);
                        return res;
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
                        return await (FDB as any)[e.name]['rangeFrom' + Case.pascalCase(i.name) + 'WithCursor'](createEmptyContext(), ...argm, arg.first, arg.after, arg.reversed);
                    }
                };
            }
        }
    }

    mutations[Case.camelCase(e.name) + 'Rebuild'] = {
        type: GraphQLString,
        resolve: async (_: any, arg: any) => {
            let all = await (FDB as any)[e.name].findAllKeys(createEmptyContext());
            for (let a of all) {
                await inTx(createEmptyContext(), async (ctx) => {
                    let k = FKeyEncoding.decodeKey(a);
                    k.splice(0, 2);
                    let itm = await (FDB as any)[e.name].findByRawId(ctx, k);
                    itm.markDirty();
                });
            }
            return 'ok';
        }
    };

    mutations[Case.camelCase(e.name) + 'Diagnose'] = {
        type: GraphQLString,
        resolve: async (_: any, arg: any) => {
            return await FDB.connection.diagnostics.runEntityDiagnostics((FDB as any)[e.name]);
        }
    };

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
                return inTx(createEmptyContext(), async (ctx) => {
                    return await (FDB as any)[e.name].create(ctx, ...ids, a.input);
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
                return inTx(createEmptyContext(), async (ctx) => {
                    let item = await (FDB as any)[e.name].findById(ctx, ...ids);
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

mutations.diagnoseAll = {
    type: GraphQLString,
    resolve: async (_: any, arg: any) => {
        let diag = '';
        for (let e of FDB.allEntities) {
            if (e.name === 'Task') {
                continue;
            }
            if (e.name === 'HyperLog') {
                continue;
            }
            if (e.name === 'UserDialogEvent') {
                continue;
            }
            if (e.name === 'ConversationEvent') {
                continue;
            }
            console.log(e.name);
            diag += await FDB.connection.diagnostics.runEntityDiagnostics(e);
        }
        return diag;
    }
};

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

queries.metaResolveId = {
    type: GraphQLInt,
    args: {
        id: {
            type: GraphQLString
        }
    },
    async resolve(_: any, a: any) {
        return IdsFactory.resolve(a.id).type.typeId;
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