import {
    GraphQLObjectType,
    GraphQLSchema,
    OperationDefinitionNode,
    GraphQLError,
    FragmentDefinitionNode,
    DocumentNode,
} from 'graphql';
import { prepareObject } from './compiler/compile';
import { CompiledOperation } from './compiler/CompiledOperation';
import { CompilerContext } from './compiler/CompilerContext';
import { ObjMap } from './utils/objMap';

export function compileQuery(args: { schema: GraphQLSchema, document: DocumentNode, operationName?: string }): CompiledOperation | GraphQLError[] {

    // Build Context
    const fragments: ObjMap<FragmentDefinitionNode> = Object.create(null);
    let operation: OperationDefinitionNode | undefined = undefined;
    for (const definition of args.document.definitions) {
        if (definition.kind === 'OperationDefinition') {
            if (!args.operationName) {
                if (operation) {
                    return [
                        new GraphQLError(
                            'Must provide operation name if query contains multiple operations.',
                        ),
                    ];
                }
                operation = definition;
            } else {
                if (definition.name && args.operationName === definition.name.value) {
                    operation = definition;
                }
            }
        }
        if (definition.kind === 'FragmentDefinition') {
            fragments[definition.name.value] = definition;
        }
    }
    if (!operation) {
        if (args.operationName != null) {
            return [new GraphQLError(`Unknown operation named "${args.operationName}".`)];
        }
        return [new GraphQLError('Must provide an operation.')];
    }
    const context: CompilerContext = {
        schema: args.schema,
        fragments,
        operation
    };

    // Resolve root type
    let objType: GraphQLObjectType;
    let kind: 'mutation' | 'query' | 'subscription';
    if (operation.operation === 'mutation') {
        objType = args.schema.getMutationType()!;
        kind = 'mutation';
    } else if (operation.operation === 'query') {
        objType = args.schema.getQueryType()!;
        kind = 'query';
    } else if (operation.operation === 'subscription') {
        objType = args.schema.getSubscriptionType()!;
        kind = 'subscription';
    } else {
        throw Error('Unknown operation');
    }

    // Resolve selection
    const selection = prepareObject(context, objType, operation.selectionSet.selections);

    return {
        ...context,
        kind,
        selection
    };
}