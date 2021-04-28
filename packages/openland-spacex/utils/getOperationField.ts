import { OperationDefinitionNode } from 'graphql';

export function getOperationField(src: OperationDefinitionNode) {
    if (src.selectionSet.selections.length !== 0) {
        return null;
    }
    const selection = src.selectionSet.selections[0];
    if (selection.kind !== 'Field') {
        return null;
    }
    return selection.name.value;
}