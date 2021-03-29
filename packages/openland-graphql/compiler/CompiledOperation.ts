import { ArgumentNode, FieldNode, FragmentDefinitionNode, GraphQLEnumType, GraphQLObjectType, GraphQLScalarType, GraphQLSchema, OperationDefinitionNode } from 'graphql';
import { ObjMap } from 'openland-graphql/utils/objMap';

export interface NonNullSelector {
    kind: 'non-null';
    type: CompiledSelector;
}

export interface CompiledListSelector {
    kind: 'list';
    type: CompiledSelector;
}

export interface CompiledScalarSelector {
    kind: 'scalar';
    type: GraphQLScalarType;
}

export interface CompiledEnumSelector {
    kind: 'enum';
    type: GraphQLEnumType;
}

export interface CompiledField {
    nodes: Array<FieldNode>;
    arguments?: ReadonlyArray<ArgumentNode>;
    selector: CompiledSelector;
}

export interface CompiledObjectSelector {
    kind: 'object';
    type: GraphQLObjectType;
    fields: ObjMap<CompiledField>;
}

export interface CompiledAbstractSelector {
    kind: 'abstract';
    types: ObjMap<CompiledObjectSelector>;
}

export type CompiledSelector = CompiledAbstractSelector | CompiledObjectSelector | CompiledScalarSelector | CompiledEnumSelector | CompiledListSelector | NonNullSelector;

export interface CompiledOperation {
    kind: 'query' | 'mutation' | 'subscription';
    schema: GraphQLSchema;
    fragments: ObjMap<FragmentDefinitionNode>;
    operation: OperationDefinitionNode;
    selection: CompiledObjectSelector;
}