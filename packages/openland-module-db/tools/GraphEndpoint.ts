import {
    GraphQLBoolean,
    GraphQLFloat,
    GraphQLInt,
    GraphQLObjectType,
    GraphQLSchema,
    GraphQLString,
    GraphQLType,
    GraphQLNonNull, GraphQLList
} from 'graphql';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { EntityFactory, EntityStorage } from '@openland/foundationdb-entity';
import * as Case from 'change-case';
import { FieldType, IndexFieldType } from '@openland/foundationdb-entity/lib/EntityDescriptor';
import { openDatabase } from '../../openland-server/foundationdb';
import { openStore } from '../store';
import { Resolvers } from '../../openland-module-api/schema/Date';

function gqlType(type: FieldType, nonNull: boolean = true): GraphQLType {
    if (type.type === 'integer') {
        return nonNull ? new GraphQLNonNull(GraphQLInt) : GraphQLInt;
    } else if (type.type === 'float') {
        return nonNull ? new GraphQLNonNull(GraphQLFloat) : GraphQLFloat;
    } else if (type.type === 'boolean') {
        return nonNull ? new GraphQLNonNull(GraphQLBoolean) : GraphQLBoolean;
    } else if (type.type === 'string') {
        return nonNull ? new GraphQLNonNull(GraphQLString) : GraphQLString;
    } else if (type.type === 'json') {
        return nonNull ? new GraphQLNonNull(GraphQLString) : GraphQLString;
    } else if (type.type === 'enum') {
        return nonNull ? new GraphQLNonNull(GraphQLString) : GraphQLString;
    } else if (type.type === 'array') {
        return nonNull ? new GraphQLNonNull(GraphQLString) : GraphQLString;
    } else if (type.type === 'struct') {
        return nonNull ? new GraphQLNonNull(GraphQLString) : GraphQLString;
    } else if (type.type === 'union') {
        return nonNull ? new GraphQLNonNull(GraphQLString) : GraphQLString;
    } else if (type.type === 'optional') {
        return gqlType(type.inner, false);
    }
    throw new Error('Unknown type');
}

function indexType(type: IndexFieldType): GraphQLType {
    if (type === 'string') {
        return new GraphQLNonNull(GraphQLString);
    } else if (type === 'boolean') {
        return new GraphQLNonNull(GraphQLBoolean);
    } else if (type === 'integer') {
        return new GraphQLNonNull(GraphQLInt);
    } else if (type === 'float') {
        return new GraphQLNonNull(GraphQLFloat);
    } else if (type === 'opt_string') {
        return GraphQLString;
    } else if (type === 'opt_boolean') {
        return GraphQLBoolean;
    } else if (type === 'opt_integer') {
        return GraphQLInt;
    } else if (type === 'opt_float') {
        return GraphQLFloat;
    }
    throw new Error('Unknown type');
}

function isComplexType(type: FieldType): boolean {
    if (type.type === 'optional') {
        return isComplexType(type.inner);
    } else if (type.type === 'array' || type.type === 'struct' || type.type === 'union' || type.type === 'json') {
        return true;
    }
    return false;
}

export async function createGraphQLAdminSchema() {
    const rootCtx = createNamedContext('graphql-admin');
    const log = createLogger('graphql-admin');

    // Init DB
    let db = await openDatabase();

    // New Entity
    let storage = new EntityStorage(db);
    let store = await openStore(storage);

    let entitiesMap: any = {};
    let queries: any = {};

    let dateType = Resolvers.Date;
    let entityMetadataType = new GraphQLObjectType({
        name: 'EntityMetadata',
        fields: {
            createdAt: {
                type: dateType,
            },
            updatedAt: {
                type: dateType
            }
        }
    });

    entitiesMap[dateType.name] = dateType;
    entitiesMap[entityMetadataType.name] = entityMetadataType;

    for (let f in store) {
        let val = (store as any)[f];

        if (val instanceof EntityFactory) {

            let fields: any = {};

            for (let field of val.descriptor.fields) {
                if (field.secure) {
                    continue;
                }
                fields[field.name] = {
                    type: gqlType(field.type),
                    resolve: (entity: any) => {
                        return isComplexType(field.type) ? (entity[field.name] ? JSON.stringify(entity[field.name]) : null) : entity[field.name];
                    }
                };
            }

            for (let key of val.descriptor.primaryKeys) {
                fields[key.name] = {
                    type: indexType(key.type)
                };
            }

            entitiesMap[val.descriptor.name] = new GraphQLObjectType({
                name: val.descriptor.name,
                fields: {
                    ...fields,
                    metadata: {
                        type: entityMetadataType,
                        resolve: entity => entity.metadata
                    }
                    // rawValue: {
                    //     type: GraphQLString,
                    //     resolve: entity => JSON.stringify(entity._rawValue)
                    // }
                }
            });

            let args: any = {};
            for (let key of val.descriptor.primaryKeys) {
                args[key.name] = {
                    type: indexType(key.type)
                };
            }

            let name = Case.camelCase(val.descriptor.name);

            queries[name] = {
                type: entitiesMap[val.descriptor.name],
                args: args,
                resolve(_: any, a: any) {
                    log.log(rootCtx, name, a);
                    let ids: any[] = [];
                    for (let key of val.descriptor.primaryKeys) {
                        ids.push(a[key.name]);
                    }
                    return (store as any)[val.descriptor.name].findById(rootCtx, ...ids);
                }
            };

            queries[name + 'All'] = {
                type: new GraphQLList(entitiesMap[val.descriptor.name]),
                resolve(_: any, a: any) {
                    log.log(rootCtx, name + 'All');
                    return (store as any)[val.descriptor.name].findAll(rootCtx);
                }
            };

            for (let index of val.descriptor.secondaryIndexes) {
                if (index.type.type === 'range') {
                    let indexArgs: any = {};
                    for (let key of index.type.fields.slice(0, -1)) {
                        indexArgs[key.name] = {
                            type: indexType(key.type)
                        };
                    }

                    queries[index.name + Case.upperCaseFirst(name) + 'All'] = {
                        type: new GraphQLList(entitiesMap[val.descriptor.name]),
                        args: indexArgs,
                        resolve(_: any, a: any) {
                            log.log(rootCtx, index.name + Case.upperCaseFirst(name));
                            let input: any[] = [];
                            for (let key of index.type.fields.slice(0, -1)) {
                                input.push(a[key.name]);
                            }
                            return (store as any)[val.descriptor.name][index.name].findAll(rootCtx, ...input);
                        }
                    };
                } else if (index.type.type === 'unique') {
                    let indexArgs: any = {};
                    for (let key of index.type.fields) {
                        indexArgs[key.name] = {
                            type: indexType(key.type)
                        };
                    }

                    queries[index.name + Case.upperCaseFirst(name)] = {
                        type: new GraphQLList(entitiesMap[val.descriptor.name]),
                        args: indexArgs,
                        resolve(_: any, a: any) {
                            log.log(rootCtx, index.name + Case.upperCaseFirst(name));
                            let input: any[] = [];
                            for (let key of index.type.fields) {
                                input.push(a[key.name]);
                            }
                            return (store as any)[val.descriptor.name][index.name].find(rootCtx, ...input);
                        }
                    };
                }
            }
        }
    }

    return new GraphQLSchema({
        query: new GraphQLObjectType({
            name: 'RootQueryType',
            fields: queries
        })
    });
}