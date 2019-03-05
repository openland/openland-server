import {
    DefinitionNode,
    DirectiveNode,
    FieldDefinitionNode,
    InputObjectTypeDefinitionNode,
    InterfaceTypeDefinitionNode,
    ObjectTypeDefinitionNode,
    ObjectTypeExtensionNode,
    parse,
    TypeNode,
    UnionTypeDefinitionNode
} from 'graphql';
import { DocumentNode, EnumTypeDefinitionNode } from 'graphql/language/ast';
import { createHash } from 'crypto';

const NAMESPACE = 'GQL';
const PRIMITIVE_TYPES: any = {
    String: 'string',
    Float: 'number',
    Int: 'number',
    ID: 'string',
    Boolean: 'boolean',
    Date: 'Date',
};
const ENUMS = new Set<string>();

type GenericTypeNode = InterfaceTypeDefinitionNode | ObjectTypeDefinitionNode;

export function genSchemeSpec(ast: DocumentNode): string {
    ast = applyExtensions(ast);

    let types = genTypes(ast);
    let V = createHash('md5').update(types).digest('hex');

    let out = `// THIS FILE IS AUTOGENERATED! DO NOT TRY TO EDIT!\n`;

    out += `import { ComplexTypedResolver, ComplexTypedSubscriptionResolver, UnionTypeResolver, Nullable, OptionalNullable } from './SchemaUtils';\n`;
    out += `import { GQLRoots } from './SchemaRoots';\n`;
    out += `\n`;
    out += `export const GQL_SPEC_VERSION = '${V}';\n`;
    out += `\n`;
    out += `export namespace ${NAMESPACE} {\n`;
    out += tab(1, types) + '\n';
    out += `}`;
    out += '\n\n';
    out += genResolverInterface(ast);

    return out;
}

export function getSchemeVersion(schema: string) {
    let ast = parse(schema);
    ast = applyExtensions(ast);
    let types = genTypes(ast);
    return createHash('md5').update(types).digest('hex');
}

function genTypes(ast: DocumentNode) {
    let types = ``;

    for (let definition of ast.definitions) {
        if (definition.kind === 'InterfaceTypeDefinition') {
            types += genType(definition) + '\n';
        }
        if (definition.kind === 'ObjectTypeDefinition') {
            types += genType(definition) + '\n';
        }
        if (definition.kind === 'InputObjectTypeDefinition') {
            types += genInputType(definition) + '\n';
        }
        if (definition.kind === 'EnumTypeDefinition') {
            ENUMS.add(definition.name.value);
            types += genEnum(definition) + '\n';
        }
        if (definition.kind === 'UnionTypeDefinition') {
            types += genUnion(definition) + '\n';
        }
    }
    return types;
}

function applyExtensions(ast: DocumentNode) {
    let out = {...ast};

    for (let definition of ast.definitions) {
        if (definition.kind === 'ObjectTypeExtension') {
            let obj: ObjectTypeDefinitionNode | undefined = out.definitions.find(d => d.kind === 'ObjectTypeDefinition' && d.name.value === (definition as ObjectTypeExtensionNode).name.value) as ObjectTypeDefinitionNode;
            if (!obj) {
                throw new Error('Extension of non-declared type');
            }
            (obj.fields as FieldDefinitionNode[]).push(...(definition.fields || []));
        }
    }
    // (out.definitions as any) = out.definitions.filter(d => d.kind !== 'ObjectTypeExtension');

    return out;
}

function genResolverInterface(ast: DocumentNode) {
    function fetchType(type: TypeNode, nullable: boolean = true): string {
        switch (type.kind) {
            case 'NamedType':
                let typeName = PRIMITIVE_TYPES[type.name.value] || type.name.value;

                if (nullable) {
                    return `Nullable<GQLRoots.${typeName}Root>`;
                } else {
                    return `GQLRoots.${typeName}Root`;
                }
            case 'NonNullType':
                return fetchType(type.type, false);

            case 'ListType':
                if (nullable) {
                    return `Nullable<${fetchType(type.type)}[]>`;
                } else {
                    return `${fetchType(type.type)}[]`;
                }

            default:
                return 'UnknownType';
        }
    }

    let out = '';

    out += 'export interface GQLResolver {\n';
    for (let def of ast.definitions) {
        if (isObjectTypeDefinitionNode(def)) {

            let returnTypesMap = (def.fields || [])
                .filter(f => !isPrimitiveType(f.type))
                .map(f => `${f.name.value}: ${fetchType(f.type)}`)
                .join(', ');

            let argsMap = (def.fields || [])
                .map(f => f.arguments && f.arguments.length > 0 ? `${f.name.value}: GQL.${argumentsInterfaceName(def as any, f)}` : undefined)
                .filter(d => !!d)
                .join(', ');

            let isSubscription = def.name.value === 'Subscription';

            out += genTab(1) + `${def.name.value}?: ${isSubscription ? 'ComplexTypedSubscriptionResolver' : 'ComplexTypedResolver'}<GQL.${def.name.value}, GQLRoots.${def.name.value}Root, {${returnTypesMap}}, {${argsMap}}>;\n`;
        } else if (isUnionTypeDefinition(def)) {
            let returnTypes = ((def.types && def.types.map(t => t.name.value)) || []).map(n => `'${n}'`);
            out += genTab(1) + `${def.name.value}?: UnionTypeResolver<GQLRoots.${def.name.value}Root, ${returnTypes.join(' | ')}>;\n`;
        }
    }
    out += '}\n';

    return out;
}

function isObjectTypeDefinitionNode(ast: GenericTypeNode | DefinitionNode): ast is ObjectTypeDefinitionNode {
    return ast.kind === 'ObjectTypeDefinition';
}

function isUnionTypeDefinition(ast: GenericTypeNode | DefinitionNode): ast is UnionTypeDefinitionNode {
    return ast.kind === 'UnionTypeDefinition';
}

function genInputType(ast: InputObjectTypeDefinitionNode): string {
    let out = ``;

    out += `export interface ${ast.name.value} {\n`;

    for (let field of ast.fields || []) {
        out += `${genTab(1)}${field.name.value}: ${renderType(field.type)};\n`;
    }

    out += `}`;

    return out;
}

function genType(ast: GenericTypeNode): string {
    let out = ``;

    let extendsInterface = '';

    if (isObjectTypeDefinitionNode(ast) && ast.interfaces && ast.interfaces.length > 0) {
        extendsInterface = ` extends ${ast.interfaces[0].name.value}`;
    }

    out += `export interface ${ast.name.value}${extendsInterface} {\n`;

    let extraTypes = ``;

    for (let field of ast.fields || []) {
        out += `${genTab(1)}${field.name.value}: ${renderType(field.type)};\n`;

        if (field.arguments && field.arguments.length > 0) {
            extraTypes += genFunctionArguments(ast, field) + '\n';
        }
    }

    out += `}`;

    return out + '\n' + extraTypes;
}

function argumentsInterfaceName(type: GenericTypeNode | ObjectTypeExtensionNode, field: FieldDefinitionNode): string {
    return `${type.name.value}${capitalize(field.name.value)}Args`;
}

function genFunctionArguments(type: GenericTypeNode | ObjectTypeExtensionNode, field: FieldDefinitionNode): string {
    let out = ``;

    out += `export interface ${argumentsInterfaceName(type, field)} {\n`;

    for (let argument of field.arguments!) {
        out += `${genTab(1)}${argument.name.value}: ${renderArgsType(applyIDsDirective(argument).type)};\n`;
    }

    out += `}`;

    return out;
}

function applyIDsDirective(node: { type: TypeNode, directives?: ReadonlyArray<DirectiveNode> }) {
    return node;
    // let haveIDDirective = node.directives && node.directives.find(d => d.name.value.substr(-2) === 'ID');
    // if (haveIDDirective) {
    //     const replace = (t: TypeNode) => {
    //         if (t.kind === 'NamedType') {
    //             (t.name.value as any) = 'Int';
    //         } else if (t.kind === 'ListType') {
    //             replace(t.type);
    //         } else if (t.kind === 'NonNullType') {
    //             replace(t.type);
    //         }
    //     };
    //     replace(node.type);
    //     return node;
    // }
    // return node;
}

function genEnum(type: EnumTypeDefinitionNode): string {
    let out = ``;

    out += `export type ${type.name.value} = `;

    let values = type.values!.map(val => `'${val.name.value}'`);

    out += `${values.join(' | ')};`;

    return out;
}

function genUnion(type: UnionTypeDefinitionNode): string {
    let out = ``;
    let types = (type.types || []).map(t => t.name.value);

    out += `export type ${type.name.value} = ${types.join(' | ')};`;
    return out;
}

function isPrimitiveType(type: TypeNode): boolean {
    switch (type.kind) {
        case 'NamedType':
            return ENUMS.has(type.name.value) ? true : !!PRIMITIVE_TYPES[type.name.value];
        case 'NonNullType':
            return isPrimitiveType(type.type);

        case 'ListType':
            return isPrimitiveType(type.type);

        default:
            return false;
    }
}

function renderArgsType(type: TypeNode, nullable: boolean = true): string {
    switch (type.kind) {
        case 'NamedType':
            let typeName = PRIMITIVE_TYPES[type.name.value] || type.name.value;

            if (nullable) {
                return `OptionalNullable<${typeName}>`;
            } else {
                return `${typeName}`;
            }
        case 'NonNullType':
            return renderArgsType(type.type, false);

        case 'ListType':
            if (nullable) {
                return `OptionalNullable<${renderArgsType(type.type)}[]>`;
            } else {
                return `${renderArgsType(type.type)}[]`;
            }

        default:
            return 'UnknownType';
    }
}

function renderType(type: TypeNode, nullable: boolean = true): string {
    switch (type.kind) {
        case 'NamedType':
            let typeName = PRIMITIVE_TYPES[type.name.value] || type.name.value;

            if (nullable) {
                return `Nullable<${typeName}>`;
            } else {
                return `${typeName}`;
            }
        case 'NonNullType':
            return renderType(type.type, false);

        case 'ListType':
            if (nullable) {
                return `Nullable<${renderType(type.type)}[]>`;
            } else {
                return `${renderType(type.type)}[]`;
            }

        default:
            return 'UnknownType';
    }
}

function genTab(n: number): string {
    return new Array(n).fill('    ').join('');
}

function tab(n: number, s: string) {
    let out: string[] = [];
    let parts = s.split('\n');
    for (let part of parts) {
        if (part.length === 0) {
            continue;
        }
        out.push(genTab(n) + part);
    }
    return out.join('\n');
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}