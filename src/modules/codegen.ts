import {
    FieldDefinitionNode, InputObjectTypeDefinitionNode, InterfaceTypeDefinitionNode, ObjectTypeDefinitionNode,
    ObjectTypeExtensionNode,
    parse, TypeNode
} from 'graphql';
import { DocumentNode, EnumTypeDefinitionNode } from 'graphql/language/ast';

let schemeAst = parse(`
type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    itemsCount: Int!
    pagesCount: Int!
    currentPage: Int!
    openEnded: Boolean!
}

type Likes {
    liked: Boolean!
    count: Int
}

type Chart {
    labels: [String!]!
    datasets: [ChartDataSet!]!
}
  
type ChartDataSet {
    label: String!
    values: [Float!]!
}

type Picture {
    src: String
    url: String!
    retina: String!
}

type SearchResult {
    query: String!
}

type SearchHighlight {
    key: String!
    match: String!
}

type MapPoint {
    ref: String
    count: Int
    lat: Float!
    lon: Float!
}

input MapPointInput {
    ref: String
    count: Int
    lat: Float!
    lon: Float!
}

enum MapSearchZoom {
    LOW
    MEDIUM
    HIGH
}

enum TaskStatus {
    IN_PROGRESS
    FAILED
    COMPLETED
}

type Task {
    id: ID!
    status: TaskStatus!
    result: String
}

input ImageCropInput {
    x: Int!
    y: Int!
    w: Int!
    h: Int!
}

type ImageCrop {
    x: Int!
    y: Int!
    w: Int!
    h: Int!
}

type ImageRef {
    uuid: String!
    crop: ImageCrop
}

input ImageRefInput {
    uuid: String!
    crop: ImageCropInput
}

type Range {
    from: Int
    to: Int
}

input RangeInput {
    from: Int
    to: Int
}
`
);

const GLOBAL_PREFIX = 'GQL';

type GenericTypeNode = InterfaceTypeDefinitionNode | ObjectTypeDefinitionNode;

function gen(ast: DocumentNode): string {
    let out = ``;

    for (let definition of ast.definitions) {
        if (definition.kind === 'InterfaceTypeDefinition') {
            out += genType(definition) + '\n';
        }
        if (definition.kind === 'ObjectTypeDefinition') {
            out += genType(definition) + '\n';
        }
        if (definition.kind === 'InputObjectTypeDefinition') {
            out += genInputType(definition) + '\n';
        }
        if (definition.kind === 'EnumTypeDefinition') {
            out += genEnum(definition) + '\n';
        }
        if (definition.kind === 'ObjectTypeExtension') {
            out += genExtension(definition) + '\n';
        }
    }

    return out;
}

function isObjectTypeDefinitionNode(ast: GenericTypeNode): ast is ObjectTypeDefinitionNode {
    return ast.kind === 'ObjectTypeDefinition';
}

function genInputType(ast: InputObjectTypeDefinitionNode): string {
    let out = ``;

    out += `export interface ${GLOBAL_PREFIX}${ast.name.value} {\n`;

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
        extendsInterface = ` extends ${GLOBAL_PREFIX}${ast.interfaces[0].name.value}`;
    }

    out += `export interface ${GLOBAL_PREFIX}${ast.name.value}${extendsInterface} {\n`;

    let extraTypes = ``;

    for (let field of ast.fields || []) {
        if (field.arguments && field.arguments.length > 0) {
            let args: string[] = [];

            for (let argument of field.arguments) {
                args.push(`${argument.name.value}: ${renderType(argument.type)}`);
            }

            out += `${genTab(1)}${field.name.value}(${args.join(', ')}): ${renderType(field.type)};\n`;

            extraTypes += genFunctionArguments(ast, field) + '\n';
            extraTypes += genFunctionReturnType(ast, field) + '\n';

            continue;
        }
        out += `${genTab(1)}${field.name.value}: ${renderType(field.type)};\n`;
    }

    out += `}`;

    return out + '\n' + extraTypes;
}

function genFunctionArguments(type: GenericTypeNode | ObjectTypeExtensionNode, field: FieldDefinitionNode): string {
    let out = ``;

    out += `export interface ${GLOBAL_PREFIX}${type.name.value}${capitalize(field.name.value)}Args {\n`;

    for (let argument of field.arguments!) {
        out += `${genTab(1)}${argument.name.value}: ${renderType(argument.type)};\n`;
    }

    out += `}`;

    return out;
}

function genFunctionReturnType(type: GenericTypeNode | ObjectTypeExtensionNode, field: FieldDefinitionNode): string {
    let out = ``;

    out += `export type ${GLOBAL_PREFIX}${type.name.value}${capitalize(field.name.value)}Result = ${renderType(field.type)};`;

    return out;
}

function genEnum(type: EnumTypeDefinitionNode): string {
    let out = ``;

    out += `export type ${GLOBAL_PREFIX}${type.name.value} = `;

    let values = type.values!.map(val => `'${val.name.value}'`);

    out += `${values.join(' | ')};`;

    return out;
}

function genExtension(type: ObjectTypeExtensionNode): string {
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

const PRIMITIVE_TYPES: any = {
    String: 'string',
    Float: 'number',
    Int: 'number',
    ID: 'number',
    Boolean: 'boolean'
};

function renderType(type: TypeNode, nullable: boolean = true): string {
    switch (type.kind) {
        case 'NamedType':
            let typeName = PRIMITIVE_TYPES[type.name.value] || GLOBAL_PREFIX + type.name.value;

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

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// type Nullable<T> = undefined | null | T;

//
// interface Test {
//     lol: Nullable<Nullable<number>;
// }

console.log(gen(schemeAst));