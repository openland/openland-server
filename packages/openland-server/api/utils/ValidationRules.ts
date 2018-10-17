import ValidationContext from 'graphql/validation/ValidationContext';
import { FieldNode, GraphQLError } from 'graphql';
import { CallContext } from './CallContext';

export function disableIntrospection(callCtx?: CallContext) {
    return (ctx: ValidationContext) => {
        return {
            Field(node: FieldNode) {
                let name = node.name.value;

                if (process.env.NODE_ENV !== 'production') {
                    return;
                }

                if (name === '__schema' || name === '__type') {
                    if (callCtx && callCtx.superRope === 'super-admin') {
                        return;
                    }

                    ctx.reportError(
                        new GraphQLError('Introspection is not allowed', [node])
                    );
                }
            }
        };
    };
}