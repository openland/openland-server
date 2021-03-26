import { Context } from '@openland/context';
import { GraphQLField, GraphQLFieldResolver, GraphQLObjectType, GraphQLOutputType, GraphQLSchema } from 'graphql';
import { isPromise } from 'openland-utils/isPromise';

export type FieldHandler = (type: GraphQLObjectType, field: GraphQLField<any, any>, originalResolver: GraphQLFieldResolver<any, any, any>, root: any, args: any, context: Context, info: any) => any;
export type ObjectHandler = (type: GraphQLOutputType, value: any, context: Context, info: any) => any;

export type InstrumentationConfig = {
    field?: FieldHandler;
    object?: ObjectHandler;
};

function instrumentField(type: GraphQLObjectType, field: GraphQLField<any, any, { [key: string]: any; }>, config: InstrumentationConfig) {
    const fieldHandler = config.field;
    const objectHandler = config.object;

    if (fieldHandler && field.resolve) {
        const originalResolve = field.resolve;
        field.resolve = (root: any, args: any, context: Context, info: any) => {
            let res = fieldHandler(type, field, originalResolve, root, args, context, info);
            if (objectHandler) {
                if (isPromise(res)) {
                    return res.then((v) => objectHandler(field.type, v, context, info));
                } else {
                    return objectHandler(field.type, res, context, info);
                }
            } else {
                return res;
            }
        };
    }
}

function instrumentEachField(schema: GraphQLSchema, config: InstrumentationConfig) {
    let types = schema.getTypeMap();

    for (let typeName in types) {
        if (!Object.hasOwnProperty.call(types, typeName)) {
            continue;
        }

        let type = types[typeName];

        if (type instanceof GraphQLObjectType && !type.name.startsWith('__')) {
            let fields = type.getFields();

            for (let fieldName in fields) {
                if (!Object.hasOwnProperty.call(fields, fieldName)) {
                    continue;
                }
                const field = fields[fieldName];
                instrumentField(type, field, config);
            }
        }
    }
}

export function instrumentSchema(schema: GraphQLSchema, config: InstrumentationConfig) {
    instrumentEachField(schema, config);
}
