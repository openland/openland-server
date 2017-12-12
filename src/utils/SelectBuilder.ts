import * as sequelize from 'sequelize'
import { DB } from '../tables/index';
import { sumRaw, countRaw, textLikeFieldsText, findAllRaw } from './db_utils';

export class SelectBuilder {

    table: sequelize.Model<any, any>;

    private orderbyFields: Array<{ field: string, order: string }> = new Array();
    private textFilterFields: Array<string> = new Array();
    private filterText: string | null = null
    private conditions: Array<string> = new Array();
    private conditionsEq: Array<{ field: string, value: any }> = new Array();
    private limitValue: number | null = null
    private afterValue: string | null = null

    constructor(table: sequelize.Model<any, any>) {
        this.table = table
    }

    limit(limit?: number) {
        let cloned = this.clone();
        if (limit) {
            if (limit < 0) {
                cloned.limitValue = null
            } else if (limit > 100) {
                throw "Maximum number of fetched results is " + 100
            } else {
                cloned.limitValue = limit;
            }
        } else {
            cloned.limitValue = null
        }
        return cloned;
    }

    after(after?: string) {
        let cloned = this.clone();
        if (after) {
            cloned.afterValue = after;
        } else {
            cloned.afterValue = null;
        }
        return cloned;
    }

    where(condition: string) {
        let cloned = this.clone();
        cloned.conditions.push(condition);
        return cloned;
    }

    whereEq(field: string, value: any) {
        let cloned = this.clone();
        cloned.conditionsEq.push({ field: field, value: value });
        return cloned;
    }

    orderByRaw(field: string, order?: 'ASC' | 'DESC') {
        let cloned = this.clone();
        if (order) {
            cloned.orderbyFields.push({ field: field, order: order });
        } else {
            cloned.orderbyFields.push({ field: field, order: "ASC" });
        }
        return cloned;
    }

    orderBy(field: string, order?: 'ASC' | 'DESC') {
        return this.orderByRaw(`"${field}"`, order)
    }

    filter(text?: string) {
        let cloned = this.clone();
        if (text != undefined && text != null && text.trim().length > 0) {
            cloned.filterText = text;
        } else {
            cloned.filterText = null;
        }
        return cloned;
    }

    filterField(field: string) {
        let cloned = this.clone();
        cloned.textFilterFields.push(field)
        return cloned;
    }

    buildOrderBy() {
        let converted = this.orderbyFields.map((p) => `${p.field} ${p.order}`)
        let all = [...converted, `"id" ASC`];
        return "ORDER BY " + all.join(", ");
    }

    buildWhere() {
        let eqConditions = this.conditionsEq.map((p) => {
            if (p.value === null) {
                return `"${p.field}" IS NULL`
            } else if (typeof (p.value) === "string") {
                return `"${p.field}" = ` + DB.connection.escape(p.value)
            } else {
                return `"${p.field}" = ` + p.value
            }
        })
        var conditions = [...this.conditions, ...eqConditions];
        if (this.filterText != null) {
            conditions.push(textLikeFieldsText(this.table, this.filterText.trim(), this.textFilterFields));
        }
        if (conditions.length == 0) {
            return ""
        } else if (conditions.length == 1) {
            return conditions[0]
        } else {
            return conditions.join(' AND ')
        }
    }

    async findAll() {
        var query = "SELECT * FROM " + this.table.getTableName() as string;
        query += " WHERE " + this.buildWhere()
        query += " " + this.buildOrderBy()
        let offset = 0
        if (this.afterValue) {
            offset = parseInt(this.afterValue);
            query += " OFFSET " + offset;
        }
        if (this.limitValue) {
            query += " LIMIT " + (offset + this.limitValue)
        }
        let res = await findAllRaw(query, this.table)
        return {
            edges: res.map((p, i) => {
                return {
                    node: p,
                    cursor: (i + 1 + offset).toString()
                }
            }),
            pageInfo: {
                hasNextPage: res.length == this.limitValue,
                hasPreviousPage: false
            },
        }
    }

    async sum(field: string) {
        return sumRaw(this.table.getTableName() as string, field, this.buildWhere())
    }

    async count() {
        return countRaw(this.table.getTableName() as string, this.buildWhere())
    }

    private clone() {
        var res = new SelectBuilder(this.table);
        res.orderbyFields = JSON.parse(JSON.stringify(this.orderbyFields));
        res.textFilterFields = JSON.parse(JSON.stringify(this.textFilterFields));
        res.filterText = this.filterText;
        res.conditions = JSON.parse(JSON.stringify(this.conditions));
        res.conditionsEq = JSON.parse(JSON.stringify(this.conditionsEq));
        res.limitValue = this.limitValue;
        res.afterValue = this.afterValue;
        return res;
    }
}