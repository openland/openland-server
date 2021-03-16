import { Context } from '@openland/context';
import { GraphQLField, GraphQLFieldResolver, GraphQLObjectType, GraphQLSchema } from 'graphql';

export type FieldHandler = (type: GraphQLObjectType, field: GraphQLField<any, any>, originalResolver: GraphQLFieldResolver<any, any, any>, root: any, args: any, context: any, info: any) => any;

export type InstrumentationConfig = {
    field?: FieldHandler;
};

function instrumentField(type: GraphQLObjectType, field: GraphQLField<any, any, { [key: string]: any; }>, config: InstrumentationConfig) {
    const fieldHandler = config.field;

    if (fieldHandler && field.resolve) {
        const originalResolve = field.resolve;
        field.resolve = (root: any, args: any, context: Context, info: any) => {
            return fieldHandler(type, field, originalResolve, root, args, context, info);
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
