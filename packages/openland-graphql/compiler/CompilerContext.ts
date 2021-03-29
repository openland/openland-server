import { FragmentDefinitionNode, GraphQLSchema, OperationDefinitionNode } from 'graphql';
import { ObjMap } from 'openland-graphql/utils/objMap';

export interface CompilerContext {
    schema: GraphQLSchema;
    fragments: ObjMap<FragmentDefinitionNode>;
    operation: OperationDefinitionNode;
}