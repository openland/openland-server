export interface FEntitySchemaKey {
    name: string;
    type: 'string' | 'number';
}

export interface FEntitySchemaField {
    name: string;
    type: 'string' | 'number' | 'json' | 'boolean' | 'enum';
    nullable: boolean;
    enumValues: string[];
}

export interface FEntitySchema {
    primaryKeys: FEntitySchemaKey[];
    fields: FEntitySchemaField[];
}