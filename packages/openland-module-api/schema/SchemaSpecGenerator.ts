import {
    DefinitionNode,
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

const PrimitiveTypesMap = new Map([
    ['String', 'string'],
    ['Float', 'number'],
    ['Int', 'number'],
    ['ID', 'string'],
    ['Boolean', 'boolean'],
    ['Date', 'Date'],
]);

type GenericTypeNode = InterfaceTypeDefinitionNode | ObjectTypeDefinitionNode;

class CodeBuilder {
    private result = '';
    private tabC = 0;

    tab() {
        this.tabC++;
    }

    unTab() {
        this.tabC--;
    }

    add(text?: string, moveLine?: boolean) {
        if (text) {
            this.result += ' '.repeat(this.tabC * 4) + text + ((moveLine !== false) ? '\n' : '');
        } else {
            this.result += '\n';
        }
    }

    addMultiline(text: string) {
        let lines = text.split('\n');
        for (let line of text.split('\n')) {
            if (line === '') {
                continue;
            }
            this.add(line, !(lines.indexOf(line) === (lines.length - 1)));
        }
    }

    addCode(code: CodeBuilder) {
        this.addMultiline(code.build());
    }

    build() {
        return this.result;
    }
}

export function genSchemeSpec(ast: DocumentNode): string {
    let enumNames = new Set<string>();

    ast = applyExtensions(ast);

    // fill enum names
    ast.definitions.forEach(d => d.kind === 'EnumTypeDefinition' && enumNames.add(d.name.value));

    let types = genTypes(ast);
    let V = createHash('md5').update(types.build()).digest('hex');

    let code = new CodeBuilder();

    code.add(`// THIS FILE IS AUTOGENERATED! DO NOT TRY TO EDIT!`);
    code.add(`import { ComplexTypedResolver, ComplexTypedSubscriptionResolver, UnionTypeResolver, Nullable, OptionalNullable } from './SchemaUtils';`);
    code.add(`import { GQLRoots } from './SchemaRoots';`);
    code.add();
    code.add(`export const GQL_SPEC_VERSION = '${V}';`);
    code.add();
    code.add(`export namespace ${NAMESPACE} {`);
    code.tab();
    code.addCode(types);
    code.unTab();
    code.add('}');
    code.add();
    code.addCode(genResolverInterface(ast, enumNames));

    return code.build();
}

export function getSchemeVersion(schema: string) {
    let ast = parse(schema);
    ast = applyExtensions(ast);
    let types = genTypes(ast);
    return createHash('md5').update(types.build()).digest('hex');
}

function genTypes(ast: DocumentNode) {
    let code = new CodeBuilder();

    for (let definition of ast.definitions) {
        if (definition.kind === 'InterfaceTypeDefinition') {
            code.addCode(genType(definition));
        }
        if (definition.kind === 'ObjectTypeDefinition') {
            code.addCode(genType(definition));
        }
        if (definition.kind === 'InputObjectTypeDefinition') {
            code.addCode(genInputType(definition));
        }
        if (definition.kind === 'EnumTypeDefinition') {
            code.add(genEnum(definition));
        }
        if (definition.kind === 'UnionTypeDefinition') {
            code.add(genUnion(definition));
        }
    }
    return code;
}

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

function genResolverInterface(ast: DocumentNode, enumNames: Set<string>) {
    function fetchType(type: TypeNode, nullable: boolean = true): string {
        switch (type.kind) {
            case 'NamedType':
                let typeName = PrimitiveTypesMap.get(type.name.value) || type.name.value;

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

    let code = new CodeBuilder();

    code.add('export interface GQLResolver {');
    code.tab();
    for (let def of ast.definitions) {
        if (isObjectTypeDefinitionNode(def)) {

            let returnTypesMap = (def.fields || [])
                .filter(f => !isPrimitiveType(f.type, enumNames))
                .map(f => `${f.name.value}: ${fetchType(f.type)}`)
                .join(', ');

            let argsMap = (def.fields || [])
                .map(f => f.arguments && f.arguments.length > 0 ? `${f.name.value}: GQL.${argumentsInterfaceName(def as any, f)}` : undefined)
                .filter(d => !!d)
                .join(', ');

            let isSubscription = def.name.value === 'Subscription';

            code.add(`${def.name.value}?: ${isSubscription ? 'ComplexTypedSubscriptionResolver' : 'ComplexTypedResolver'}<GQL.${def.name.value}, GQLRoots.${def.name.value}Root, {${returnTypesMap}}, {${argsMap}}>;`);
        } else if (isUnionTypeDefinition(def)) {
            let returnTypes = ((def.types && def.types.map(t => t.name.value)) || []).map(n => `'${n}'`);
            code.add(`${def.name.value}?: UnionTypeResolver<GQLRoots.${def.name.value}Root, ${returnTypes.join(' | ')}>;`);
        }
    }
    code.unTab();
    code.add('}');

    return code;
}

function isObjectTypeDefinitionNode(ast: DefinitionNode): ast is ObjectTypeDefinitionNode {
    return ast.kind === 'ObjectTypeDefinition';
}

function isObjectTypeExtension(node: DefinitionNode): node is ObjectTypeExtensionNode {
    return node.kind === 'ObjectTypeExtension';
}

function isUnionTypeDefinition(ast: GenericTypeNode | DefinitionNode): ast is UnionTypeDefinitionNode {
    return ast.kind === 'UnionTypeDefinition';
}

function genInputType(ast: InputObjectTypeDefinitionNode) {
    let code = new CodeBuilder();

    code.add(`export interface ${ast.name.value} {`);
    for (let field of ast.fields || []) {
        code.add(`${genTab(1)}${field.name.value}: ${renderType(field.type)};`);
    }
    code.add(`}`);

    return code;
}

function genType(ast: GenericTypeNode) {
    let code = new CodeBuilder();

    let extendsInterface = '';

    if (isObjectTypeDefinitionNode(ast) && ast.interfaces && ast.interfaces.length > 0) {
        extendsInterface = ` extends ${ast.interfaces[0].name.value}`;
    }

    code.add(`export interface ${ast.name.value}${extendsInterface} {`);

    let extraTypes = new CodeBuilder();
    code.tab();
    let fields = ast.fields || [];
    for (let field of fields) {
        code.add(`${field.name.value}: ${renderType(field.type)};`);
        if (field.arguments && field.arguments.length > 0) {
            extraTypes.add(genFunctionArguments(ast, field));
            // extraTypes.add();
        }
    }
    code.unTab();

    code.add('}', false);
    if (extraTypes.build().length > 0) {
        code.add();
        code.addCode(extraTypes);
    }

    code.add();
    return code;
}

function argumentsInterfaceName(type: GenericTypeNode | ObjectTypeExtensionNode, field: FieldDefinitionNode): string {
    return `${type.name.value}${capitalize(field.name.value)}Args`;
}

function genFunctionArguments(type: GenericTypeNode | ObjectTypeExtensionNode, field: FieldDefinitionNode): string {
    let out = ``;
    out += `export interface ${argumentsInterfaceName(type, field)} {\n`;
    for (let argument of field.arguments!) {
        out += `${genTab(1)}${argument.name.value}: ${renderArgType(argument.type)};\n`;
    }
    out += `}`;
    return out;
}

function genEnum(type: EnumTypeDefinitionNode) {
    let values = type.values!.map(val => `'${val.name.value}'`);
    return `export type ${type.name.value} = ${values.join(' | ')};`;
}

function genUnion(type: UnionTypeDefinitionNode) {
    let types = (type.types || []).map(t => t.name.value);
    return `export type ${type.name.value} = ${types.join(' | ')};`;
}

function isPrimitiveType(node: TypeNode, enumNames: Set<string>): boolean {
    switch (node.kind) {
        case 'NamedType':
            return enumNames.has(node.name.value) ? true : PrimitiveTypesMap.has(node.name.value);
        case 'NonNullType':
            return isPrimitiveType(node.type, enumNames);
        case 'ListType':
            return isPrimitiveType(node.type, enumNames);
        default:
            return false;
    }
}

function renderArgType(type: TypeNode, nullable: boolean = true): string {
    switch (type.kind) {
        case 'NamedType':
            let typeName = PrimitiveTypesMap.get(type.name.value) || type.name.value;

            if (nullable) {
                return `OptionalNullable<${typeName}>`;
            } else {
                return `${typeName}`;
            }
        case 'NonNullType':
            return renderArgType(type.type, false);

        case 'ListType':
            if (nullable) {
                return `OptionalNullable<${renderArgType(type.type)}[]>`;
            } else {
                return `${renderArgType(type.type)}[]`;
            }

        default:
            return 'UnknownType';
    }
}

function renderType(type: TypeNode, nullable: boolean = true): string {
    switch (type.kind) {
        case 'NamedType':
            let typeName = PrimitiveTypesMap.get(type.name.value) || type.name.value;

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