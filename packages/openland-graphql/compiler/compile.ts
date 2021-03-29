import {
    FieldNode,
    GraphQLEnumType,
    GraphQLObjectType,
    GraphQLScalarType,
    isEnumType,
    GraphQLOutputType,
    isScalarType,
    SelectionNode,
    isListType,
    GraphQLList,
    isNonNullType,
    isObjectType,
    isAbstractType,
    GraphQLAbstractType
} from 'graphql';
import { getFieldDef } from 'graphql/execution/execute';
import { ObjMap } from 'openland-graphql/utils/objMap';
import { collectFields } from './collectFields';
import {
    CompiledAbstractSelector,
    CompiledEnumSelector,
    CompiledField,
    CompiledListSelector,
    CompiledObjectSelector,
    CompiledScalarSelector,
    CompiledSelector,
    NonNullSelector
} from './CompiledOperation';
import { CompilerContext } from './CompilerContext';

export function prepareEnum(context: CompilerContext, type: GraphQLEnumType): CompiledEnumSelector {
    return { kind: 'enum', type };
}

export function prepareScalar(context: CompilerContext, type: GraphQLScalarType): CompiledScalarSelector {
    return { kind: 'scalar', type };
}

export function prepareList(context: CompilerContext, type: GraphQLList<GraphQLOutputType>, selection?: readonly SelectionNode[]): CompiledListSelector {
    return { kind: 'list', type: prepareType(context, type.ofType, selection) };
}

export function prepareNonNull(context: CompilerContext, type: GraphQLList<GraphQLOutputType>, selection?: readonly SelectionNode[]): NonNullSelector {
    return { kind: 'non-null', type: prepareType(context, type.ofType, selection) };
}

export function prepareField(context: CompilerContext, type: GraphQLObjectType, nodes: Array<FieldNode>): CompiledField {
    const def = getFieldDef(context.schema, type, nodes[0].name.value);
    if (!def) {
        throw Error('Invalid field');
    }
    return {
        nodes,
        selector: prepareType(context, def.type, nodes[0].selectionSet?.selections)
    };
}

export function prepareObject(context: CompilerContext, type: GraphQLObjectType, selection: readonly SelectionNode[]): CompiledObjectSelector {
    const fields = collectFields(context, type, selection);
    let preparedFields: ObjMap<CompiledField> = {};
    for (let alias of Object.keys(fields)) {
        preparedFields[alias] = prepareField(context, type, fields[alias]);
    }
    return { kind: 'object', type, fields: preparedFields };
}

export function prepareAbstractObject(context: CompilerContext, type: GraphQLAbstractType, selection: readonly SelectionNode[]): CompiledAbstractSelector {
    const possibleTypes = context.schema.getPossibleTypes(type);
    const selectors: ObjMap<CompiledObjectSelector> = {};
    for (let pt of possibleTypes) {
        selectors[pt.name] = prepareObject(context, pt, selection);
    }
    return { kind: 'abstract', types: selectors };
}

export function prepareType(context: CompilerContext, type: GraphQLOutputType, selection?: readonly SelectionNode[]): CompiledSelector {
    if (isEnumType(type)) {
        return prepareEnum(context, type);
    }
    if (isScalarType(type)) {
        return prepareScalar(context, type);
    }
    if (isListType(type)) {
        return prepareList(context, type, selection);
    }
    if (isNonNullType(type)) {
        return prepareNonNull(context, type, selection);
    }
    if (isObjectType(type)) {
        if (!selection) {
            throw Error('No selectors');
        }
        return prepareObject(context, type, selection);
    }
    if (isAbstractType(type)) {
        if (!selection) {
            throw Error('No selectors');
        }
        return prepareAbstractObject(context, type, selection);
    }

    throw Error('Invalid type');
}