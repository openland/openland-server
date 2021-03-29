import { GraphQLList, GraphQLNamedType, GraphQLNonNull, Kind, ListTypeNode, NamedTypeNode, NonNullTypeNode, TypeNode, GraphQLSchema } from 'graphql';
import { inspect } from './inspect';

/**
 * Given a Schema and an AST node describing a type, return a GraphQLType
 * definition which applies to that type. For example, if provided the parsed
 * AST node for `[User]`, a GraphQLList instance will be returned, containing
 * the type called "User" found in the schema. If a type called "User" is not
 * found in the schema, then undefined will be returned.
 */
export function typeFromAST<T extends TypeNode>(
    schema: GraphQLSchema,
    typeNode: T,
):
    | (T extends NamedTypeNode
        ? GraphQLNamedType
        : T extends ListTypeNode
        ? GraphQLList<any>
        : T extends NonNullTypeNode
        ? GraphQLNonNull<any>
        : never)
    | undefined;
export function typeFromAST(
    schema: GraphQLSchema,
    typeNode: TypeNode,
): GraphQLNamedType | GraphQLList<any> | GraphQLNonNull<any> | undefined {
    if (typeNode.kind === Kind.LIST_TYPE) {
        const innerType = typeFromAST(schema, typeNode.type);
        return innerType && new GraphQLList(innerType);
    }
    if (typeNode.kind === Kind.NON_NULL_TYPE) {
        const innerType = typeFromAST(schema, typeNode.type);
        return innerType && new GraphQLNonNull(innerType);
    }
    if (typeNode.kind === Kind.NAMED_TYPE) {
        return schema.getType(typeNode.name.value) as any;
    }

    // istanbul ignore next (Not reachable. All possible type nodes have been considered)
    throw Error('Unexpected type node: ' + inspect(typeNode as never));
}