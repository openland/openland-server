import { SchemaDirectiveVisitor } from 'graphql-tools';
import {
    defaultFieldResolver,
    GraphQLArgument,
    GraphQLField,
    GraphQLInputField,
    GraphQLList,
    GraphQLNonNull,
    GraphQLScalarType,
    Kind
} from 'graphql';
import { CallContext } from '../utils/CallContext';
import { ErrorText } from '../../../openland-errors/ErrorText';
import { AccessDeniedError } from '../../../openland-errors/AccessDeniedError';
import { GraphQLFieldResolver, GraphQLInputType, GraphQLOutputType } from 'graphql/type/definition';
import { withPermission } from '../utils/Resolvers';
import { SecID } from '../../../openland-security/SecID';
import { ValueNode } from 'graphql/language/ast';
import { IDs } from '../utils/IDs';

function createFieldDirective(
    resolver: (root: any, args: any, context: CallContext, info: any, originalResolver: GraphQLFieldResolver<any, any, any>, directiveArgs: any) => any
): typeof SchemaDirectiveVisitor {
    return class extends SchemaDirectiveVisitor {
        visitFieldDefinition(field: GraphQLField<any, any>) {
            const { resolve = defaultFieldResolver } = field;

            field.resolve = async (root: any, args: any, context: CallContext, info: any) => {
                return await resolver(root, args, context, info, resolve, this.args);
            };
        }
    };
}

function createIDDirective(id: GraphQLScalarType) {
    const replaceType = (obj: { type: GraphQLInputType | GraphQLOutputType }) => {
        if (obj.type instanceof GraphQLList) {
            let vecType = obj.type.ofType;

            if (vecType instanceof GraphQLNonNull) {
                obj.type = new GraphQLList(new GraphQLNonNull(id));
            } else if (vecType instanceof GraphQLScalarType) {
                obj.type = new GraphQLList(id);
            }
        } else if (obj.type instanceof GraphQLNonNull) {
            obj.type = new GraphQLNonNull(id);
        } else if (obj.type instanceof GraphQLScalarType) {
            obj.type = id;
        }
    };

    return class extends SchemaDirectiveVisitor {
        visitArgumentDefinition(argument: GraphQLArgument) {
            replaceType(argument);
        }
        visitFieldDefinition(field: GraphQLField<any, any>) {
            replaceType(field);
        }
        visitInputFieldDefinition(field: GraphQLInputField) {
            replaceType(field);
        }
    };
}

export function IDType(type: SecID) {
    return new GraphQLScalarType({
        name: type.typeName + 'ID',

        serialize(value: any) {
            return type.serialize(value);
        },

        parseValue(value: any) {
            if (typeof value !== 'string') {
                throw new Error('ID must be string');
            }

            return type.parse(value);
        },

        parseLiteral(valueNode: ValueNode) {
            if (valueNode.kind === Kind.STRING) {
                return type.parse(valueNode.value);
            }

            throw new Error('ID must be string');
        }
    });
}

function generateIDScalars() {
    let scalars: { [key: string]: GraphQLScalarType } = {};
    for (let scalarName in IDs) {
        scalars[scalarName + 'ID'] = IDType((IDs as any)[scalarName]);
    }
    return scalars;
}

export const IDScalars = generateIDScalars();

const ALIASES: { [key: string]: string } = {
    'conversationID': 'chatID',
    'conversationMessageID': 'messageID'
};

function generateIdDirectives() {
    let directives: { [key: string]: typeof SchemaDirectiveVisitor } = {};
    for (let scalarName in IDScalars) {
        let name = scalarName.charAt(0).toLowerCase() + scalarName.substr(1);
        if (ALIASES[name]) {
            name = ALIASES[name];
        }
        directives[name] = createIDDirective(IDScalars[scalarName]);
    }
    return directives;
}

const IDScalarDirectives = generateIdDirectives();

export function injectIDScalars(schema: string): string {
    for (let scalarName in IDScalars) {
        schema += `scalar ${scalarName}\n`;
    }

    for (let scalarName in IDScalars) {
        let name = scalarName.charAt(0).toLowerCase() + scalarName.substr(1);
        if (ALIASES[name]) {
            name = ALIASES[name];
        }
        schema += `directive @${name} on ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION | FIELD_DEFINITION\n`;
    }

    return schema;
}

export const Directives = {
    withAuth: createFieldDirective(async (root, args, ctx, info, resolve) => {
        if (!ctx.uid) {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        } else {
            return await resolve(root, args, ctx, info);
        }
    }),

    withPermissions: createFieldDirective(async (root, args, ctx, info, resolve, dArgs) => {
        let permission = dArgs.permission;

        return await withPermission(
            permission,
            async (_args, _ctx) => resolve(root, _args, _ctx, info)
        )(root, args, ctx);
    }),

    withPermission: createFieldDirective(async (root, args, ctx, info, resolve, dArgs) => {
        let permission = dArgs.permission;

        return await withPermission(
            permission,
            async (_args, _ctx) => resolve(root, _args, _ctx, info)
        )(root, args, ctx);
    }),

    ...IDScalarDirectives
};