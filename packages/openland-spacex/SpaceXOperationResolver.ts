import { DocumentNode, GraphQLError, GraphQLSchema, validate } from 'graphql';
import { parse } from 'graphql';

const VALIDATION_ENABLED = false;

export class SpaceXOperationResolver {

    private schema: GraphQLSchema;
    private cache = new Map<string, { document: DocumentNode } | readonly GraphQLError[]>();

    constructor(schema: GraphQLSchema) {
        this.schema = schema;
    }

    resolve(body: string): { document: DocumentNode } | readonly GraphQLError[] {
        let cached = this.cache.get(body);
        if (cached) {
            return cached;
        }
        let parsed = parse(body);
        if (VALIDATION_ENABLED) {
            let errors = validate(this.schema, parsed);
            if (errors.length > 0) {
                this.cache.set(body, errors);
                return errors;
            }
        }

        let res = { document: parsed };
        this.cache.set(body, res);
        return res;
    }
}