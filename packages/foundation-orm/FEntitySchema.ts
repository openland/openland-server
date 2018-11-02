export interface FEntitySchemaKey {
    name: string;
    type: 'string' | 'number';
}

export interface FEntitySchemaIndex {
    name: string;
    displayName?: string;
    type: 'range' | 'unique';
    fields: string[];
}

export interface FEntitySchemaField {
    name: string;
    type: 'string' | 'number' | 'json' | 'boolean' | 'enum';
    nullable?: boolean;
    enumValues?: string[];
    secure?: boolean;
}

export interface FEntitySchema {
    name: string;
    primaryKeys: FEntitySchemaKey[];
    fields: FEntitySchemaField[];
    indexes: FEntitySchemaIndex[];
    editable?: boolean;
}