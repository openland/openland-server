import { Context } from '@openland/context';
import { getVariableValues } from 'graphql/execution/values';
import { CompiledEnumSelector, CompiledObjectSelector, CompiledOperation, CompiledScalarSelector, CompiledSelector } from './compiler/CompiledOperation';
import { inspect } from './compiler/inspect';

type ExecutionHooks = {
    resolveQuery: (name: string, context: Context, handler: (ctx: Context) => any) => any
};

const defaultHooks: ExecutionHooks = {
    resolveQuery: (name, ctx, handler) => handler(ctx)
};

type ExecutionContext = {
    operation: CompiledOperation;
    variables: any;
    hooks: ExecutionHooks;
};

function resolveLeaf(exContext: ExecutionContext, context: any, root: any, selector: CompiledScalarSelector | CompiledEnumSelector) {
    let result = selector.type.serialize(root);
    if (result === undefined) {
        throw new Error(
            `Expected a value of type "${inspect(selector.type)}" but ` +
            `received: ${inspect(result)}`,
        );
    }
    return result;
}

function resolveList(exContext: ExecutionContext, context: any, root: any, selector: CompiledScalarSelector | CompiledEnumSelector) {
    
}

async function resolveSelector(exContext: ExecutionContext, context: any, root: any, selector: CompiledSelector): any {

    // Cant't be null
    if (selector.kind === 'non-null') {
        let completed = resolveSelector(exContext, context, root, selector.type);
        if (completed === null) {
            throw new Error(
                // `Cannot return null for non-nullable field ${info.parentType.name}.${info.fieldName}.`,
            );
        }
        return completed;
    }

    if (root === null || root === undefined) {
        return null;
    }

    // Scalar
    if (selector.kind === 'scalar') {
        return resolveLeaf(exContext, context, root, selector);
    }

    // Enum
    if (selector.kind === 'enum') {
        return resolveLeaf(exContext, context, root, selector);
    }

    if (selector.kind === 'list') {

    }
}

export async function executeCompiled(args: { operation: CompiledOperation, context: any, root: any, variables: any, hooks?: Partial<ExecutionHooks> }) {
    const hooks = { ...defaultHooks, ...args.hooks };

    // Parse variables
    const variables = getVariableValues(args.operation.schema, args.operation.operation.variableDefinitions ?? [], args.variables, { maxErrors: 50 });
    if ('errors' in variables && variables.errors) {
        return variables.errors;
    }
    const coercedVariables = variables.coerced;

    // Create Context
    const context: ExecutionContext = {
        operation: args.operation,
        variables: coercedVariables,
        hooks
    };

    // Resolve selector
    await resolveSelector(context, args.context, args.root, args.operation.selection);
}