import {
    DefinitionNode,
    DocumentNode,
    FieldDefinitionNode,
    ObjectTypeDefinitionNode,
    ObjectTypeExtensionNode,
    parse
} from 'graphql';

require('module-alias/register');
import { buildSchema } from '../../openland-graphql/buildSchema';
import { createLogger } from '@openland/log';
import { createNamedContext } from '@openland/context';

const logger = createLogger('');
const ctx = createNamedContext('analyze');

async function main() {
    if (!process.argv[2]) {
        logger.log(ctx, 'Usage: yarn schema:analyze /path/to/queries.json');
        return;
    }

    let usedQueries = require(process.argv[2]);

    let schema  = applyExtensions(parse(buildSchema(__dirname + '/../../')));

    let Query = schema.definitions.find(d => d.kind === 'ObjectTypeDefinition' && d.name.value === 'Query')! as ObjectTypeDefinitionNode;
    let Mutation = schema.definitions.find(d => d.kind === 'ObjectTypeDefinition' && d.name.value === 'Mutation')! as ObjectTypeDefinitionNode;

    let queries = Query.fields!.map(f => f.name.value);
    let mutations = Mutation.fields!.map(f => f.name.value);

    let queryUsage = new Map<string, number>();
    let mutationUsage = new Map<string, number>();

    queries.forEach(q => queryUsage.set(q, 0));
    mutations.forEach(m => mutationUsage.set(m, 0));

    for (let operation of usedQueries.operations) {
        if (operation.operationType === 'query') {
            for (let field of operation.fields) {
                queryUsage.set(field.fieldName, queryUsage.get(field.fieldName)! + 1);
            }
        }
        if (operation.operationType === 'mutation') {
            for (let field of operation.fields) {
                mutationUsage.set(field.fieldName, mutationUsage.get(field.fieldName)! + 1);
            }
        }
    }

    logger.log(ctx, 'unused queries:');
    queryUsage.forEach((v, k) => v === 0 ? logger.log(ctx, k) : 0);

    logger.log(ctx, '\n\n');
    logger.log(ctx, 'unused mutations:');
    mutationUsage.forEach((v, k) => v === 0 ? logger.log(ctx, k) : 0);
}
// tslint:disable-next-line:no-floating-promises
main();

function applyExtensions(ast: DocumentNode) {
    let out = {...ast};

    for (let definition of ast.definitions) {
        if (isObjectTypeExtension(definition)) {
            let name = definition.name.value;
            let obj = out.definitions.find(d => isObjectTypeDefinitionNode(d) && d.name.value === name) as ObjectTypeDefinitionNode;
            if (!obj) {
                throw new Error('Extension of non-declared type');
            }
            (obj.fields as FieldDefinitionNode[]).push(...(definition.fields || []));
        }
    }

    return out;
}

function isObjectTypeExtension(node: DefinitionNode): node is ObjectTypeExtensionNode {
    return node.kind === 'ObjectTypeExtension';
}

function isObjectTypeDefinitionNode(ast: DefinitionNode): ast is ObjectTypeDefinitionNode {
    return ast.kind === 'ObjectTypeDefinition';
}