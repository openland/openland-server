import {
    DirectiveNode,
    FieldDefinitionNode, InputObjectTypeDefinitionNode, InterfaceTypeDefinitionNode, ObjectTypeDefinitionNode,
    ObjectTypeExtensionNode,
    parse, TypeNode, UnionTypeDefinitionNode
} from 'graphql';
import { DocumentNode, EnumTypeDefinitionNode } from 'graphql/language/ast';
import { buildSchema } from '../../openland-graphql/buildSchema';
import * as fs from 'fs';

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

let schema = buildSchema(__dirname + '/../../');
let schemeAst = parse(schema);
let res = gen(schemeAst);
fs.writeFileSync(__dirname + '/SchemaSpec.ts', res);

type GenericTypeNode = InterfaceTypeDefinitionNode | ObjectTypeDefinitionNode;

function gen(ast: DocumentNode): string {
    ast = applyExtensions(ast);
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
        if (definition.kind === 'ObjectTypeExtension') {
            // types += genExtension(definition) + '\n';
        }
        if (definition.kind === 'UnionTypeDefinition') {
            types += genUnion(definition) + '\n';
        }
    }
    let out = `// THIS FILE IS AUTOGENERATED! DO NOT TRY TO EDIT!\n`;

    out += `import { ComplexTypedResolver } from '../Resolvers';\n`;
    out += `import { GQLRoots } from './Experiments';\n`;
    out += `export type Nullable<T> = undefined | null | T;\n`;
    out += `\n`;
    out += `export namespace ${NAMESPACE} {\n`;
    out += tab(1, types) + '\n';
    out += `}`;
    out += '\n\n';
    // for (let def of ast.definitions) {
    //     if (def.kind === 'ObjectTypeDefinition' || def.kind === 'InterfaceTypeDefinition' || def.kind === 'UnionTypeDefinition') {
    //         console.log(`export type ${def.name.value}Root = any;`);
    //     }
    // }
    out += genResolverInterface(ast);
    return out;
}

function applyExtensions(ast: DocumentNode) {
    let out = { ...ast };

    for (let definition of ast.definitions) {
        if (definition.kind === 'ObjectTypeExtension') {
            let obj: ObjectTypeDefinitionNode|undefined = out.definitions.find(d => d.kind === 'ObjectTypeDefinition' && d.name.value === (definition as ObjectTypeExtensionNode).name.value) as ObjectTypeDefinitionNode;
            if (!obj) {
                throw new Error('Extension of non-declared type');
            }
            (obj.fields as FieldDefinitionNode[]).push(...(definition.fields || []));
        }
    }

    return out;
}

export function genResolverInterface(ast: DocumentNode) {
    let out = '';

    out += 'export interface GQLResolver {\n';
    for (let def of ast.definitions) {
        if (def.kind === 'ObjectTypeDefinition') {
            // // TODO: Support Query, Mutation and Subscription
            // if (def.name.value === 'Query' || def.name.value === 'Mutation' || def.name.value === 'Subscription') {
            //     continue;
            // }
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
            // function fetcRootType(type: TypeNode): string {
            //     switch (type.kind) {
            //         case 'NamedType':
            //             return type.name.value;
            //         case 'NonNullType':
            //             return fetchType(type.type);
            //
            //         case 'ListType':
            //             return fetchType(type.type);
            //
            //         default:
            //             throw new Error('Unknown type');
            //     }
            // }
            // out += genTab(1) + `${def.name.value}?: SoftlyTypedResolver<GQL.${def.name.value}>;\n`;
            // let fields = (def.fields || []).filter(f => !isPrimitiveType(f.type));
            // let fieldsRendered = fields.map(f => `${f.name.value}: ResolverRootType<AllTypes['${fetchType(f.type)}']>`).join(', ');
            // let fieldsRendered = fields.map(f => `${f.name.value}: ${fetchType(f.type)}`).join(', ');

            let returnTypesMap = (def.fields || [])
                .filter(f => !isPrimitiveType(f.type))
                .map(f => `${f.name.value}: ${fetchType(f.type)}`)
                .join(', ');

            let argsMap = (def.fields || [])
                .map(f => f.arguments && f.arguments.length > 0 ? `${f.name.value}: GQL.${argumentsInterfaceName(def as any, f)}` : undefined)
                .filter(d => !!d)
                .join(', ');

            // console.log(argsMap);

            // out += genTab(1) + `${def.name.value}?: ComplexTypedResolver<GQL.${def.name.value}, {${fieldsRendered}}, GQLRoots.${def.name.value}Root>;\n`;
            out += genTab(1) + `${def.name.value}?: ComplexTypedResolver<GQL.${def.name.value}, GQLRoots.${def.name.value}Root, {${returnTypesMap}}, {${argsMap}}>;\n`;
        }
    }
    out += '}\n';

    return out;
}

function isObjectTypeDefinitionNode(ast: GenericTypeNode): ast is ObjectTypeDefinitionNode {
    return ast.kind === 'ObjectTypeDefinition';
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

function genType(ast: GenericTypeNode, genFuncs: boolean = false): string {
    let out = ``;

    let extendsInterface = '';

    if (isObjectTypeDefinitionNode(ast) && ast.interfaces && ast.interfaces.length > 0) {
        extendsInterface = ` extends ${ast.interfaces[0].name.value}`;
    }

    out += `export interface ${ast.name.value}${extendsInterface} {\n`;

    let extraTypes = ``;

    for (let field of ast.fields || []) {
        if (field.arguments && field.arguments.length > 0) {
            let args: string[] = [];

            for (let argument of field.arguments) {
                args.push(`${argument.name.value}: ${renderType(argument.type)}`);
            }

            if (genFuncs) {
                out += `${genTab(1)}${field.name.value}(${args.join(', ')}): ${renderType(field.type)};\n`;
            } else {
                out += `${genTab(1)}${field.name.value}?: ${renderType(field.type)};\n`;
            }

            extraTypes += genFunctionArguments(ast, field) + '\n';
            extraTypes += genFunctionReturnType(ast, field) + '\n';

            continue;
        }
        out += `${genTab(1)}${field.name.value}?: ${renderType(field.type)};\n`;
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
        out += `${genTab(1)}${argument.name.value}: ${renderType(applyIDsDirective(argument).type)};\n`;
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

function genFunctionReturnType(type: GenericTypeNode | ObjectTypeExtensionNode, field: FieldDefinitionNode): string {
    return `export type ${type.name.value}${capitalize(field.name.value)}Result = ${renderType(field.type)};`;
}

function genEnum(type: EnumTypeDefinitionNode): string {
    let out = ``;

    out += `export type ${type.name.value} = `;

    let values = type.values!.map(val => `'${val.name.value}'`);

    out += `${values.join(' | ')};`;

    return out;
}

export function genExtension(type: ObjectTypeExtensionNode): string {
    let out = ``;

    if (!type.fields) {
        return out;
    }

    for (let field of type.fields) {
        if (field.arguments && field.arguments.length > 0) {
            out += genFunctionArguments(type, field) + '\n';
            out += genFunctionReturnType(type, field) + '\n';
        }
    }
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