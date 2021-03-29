import { Kind, FieldNode, GraphQLObjectType, FragmentDefinitionNode, InlineFragmentNode, isAbstractType, SelectionNode } from 'graphql';
import { ObjMap } from 'openland-graphql/utils/objMap';
import { CompilerContext } from './CompilerContext';
import { typeFromAST } from './typeFromAST';

function _doesFragmentConditionMatch(
    compilerContext: CompilerContext,
    fragment: FragmentDefinitionNode | InlineFragmentNode,
    type: GraphQLObjectType,
): boolean {
    const typeConditionNode = fragment.typeCondition;
    if (!typeConditionNode) {
        return true;
    }
    const conditionalType = typeFromAST(compilerContext.schema, typeConditionNode);
    if (conditionalType === type) {
        return true;
    }
    if (isAbstractType(conditionalType)) {
        return compilerContext.schema.isSubType(conditionalType, type);
    }
    return false;
}

function _collectFields(
    compilerContext: CompilerContext,
    runtimeType: GraphQLObjectType,
    selections: readonly SelectionNode[],
    fields: ObjMap<Array<FieldNode>>,
    visitedFragmentNames: ObjMap<boolean>
) {
    // console.warn(selections);
    for (const selection of selections) {
        switch (selection.kind) {
            case Kind.FIELD: {
                const name = selection.alias ? selection.alias.value : selection.name.value;
                if (!fields[name]) {
                    fields[name] = [];
                }
                fields[name].push(selection);
                continue;
            }
            case Kind.INLINE_FRAGMENT: {
                if (!_doesFragmentConditionMatch(compilerContext, selection, runtimeType)) {
                    continue;
                }
                _collectFields(
                    compilerContext,
                    runtimeType,
                    selection.selectionSet.selections,
                    fields,
                    visitedFragmentNames,
                );
                continue;
            }
            case Kind.FRAGMENT_SPREAD: {
                const fragName = selection.name.value;
                if (visitedFragmentNames[fragName]) {
                    continue;
                }
                visitedFragmentNames[fragName] = true;
                const fragment = compilerContext.fragments[fragName];
                if (!fragment || !_doesFragmentConditionMatch(compilerContext, fragment, runtimeType)) {
                    continue;
                }
                _collectFields(
                    compilerContext,
                    runtimeType,
                    fragment.selectionSet.selections,
                    fields,
                    visitedFragmentNames,
                );
                continue;
            }
            default: {
                // Nothing to do
                continue;
            }
        }
    }
}

/**
 * Given a selectionSet, adds all of the fields in that selection to
 * the passed in map of fields, and returns it at the end.
 *
 * CollectFields requires the "runtime type" of an object. For a field which
 * returns an Interface or Union type, the "runtime type" will be the actual
 * Object type returned by that field.
 */
export function collectFields(
    comilerContext: CompilerContext,
    runtimeType: GraphQLObjectType,
    selections: readonly SelectionNode[]
): ObjMap<Array<FieldNode>> {
    let fields: ObjMap<Array<FieldNode>> = {};
    _collectFields(comilerContext, runtimeType, selections, fields, {});
    return fields;
}