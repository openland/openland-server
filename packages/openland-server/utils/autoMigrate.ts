import { DefineAttributes, DefineOptions, Model } from 'sequelize';
import { connection } from '../modules/sequelizeConnector';

export function defineModel<TInstance, TAttributes>(
    modelName: string,
    attributes: DefineAttributes,
    options?: DefineOptions<TInstance>
): Model<TInstance, TAttributes> {
    let model = connection.define<TInstance, TAttributes>(modelName, attributes, options) as any; // some type problems here
    // getSchema(model);

    return model;
}

export async function getSchema(model: Model<any, any>) {
    let schema = await connection.query('select * from INFORMATION_SCHEMA.COLUMNS where TABLE_NAME= ? order by ordinal_position;', { replacements: [model.getTableName()]});

    genSchema(schema[0]);
}

let TYPES = {
    'integer': 'INTEGER',
    'character varying': 'STRING',
    'boolean': 'BOOLEAN',
    'timestamp with time zone': 'DATE',
    'json': 'JSON',
};

function genSchema(schema: { column_name: string, data_type: string }[]) {
    let out = '{\n';

    for (let column of schema) {
        let typeName = (TYPES as any)[column.data_type] || 'unknown';

        out += `{ type: sequelize.${typeName}, unique: true },\n`;
    }

    out += '}';

    console.log(out);
}