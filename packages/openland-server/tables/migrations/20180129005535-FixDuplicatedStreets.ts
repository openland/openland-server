import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {

    // let query = `DELETE FROM "permit_street_numbers" a USING (
    //     SELECT MIN(ctid) as ctid, "permitId", "streetNumberId"
    //       FROM "permit_street_numbers"
    //       GROUP BY "permitId", "streetNumberId" HAVING COUNT(*) > 1
    //     ) b
    //     WHERE a."permitId" = b."permitId" AND a."streetNumberId" = b."streetNumberId"
    //     AND a.ctid <> b.ctid`;

    let query = `DELETE FROM "permit_street_numbers"
    WHERE ctid IN (
      SELECT unnest(array_remove(all_ctids, actid))
      FROM (
             SELECT
               min(b.ctid)     AS actid,
               array_agg(ctid) AS all_ctids
             FROM "permit_street_numbers" b
             GROUP BY "permitId", "streetNumberId"
             HAVING count(*) > 1) c);`;

    await queryInterface.sequelize.query(query);

    await queryInterface.addIndex('permit_street_numbers', ['permitId', 'streetNumberId'], {
        indicesType: 'UNIQUE'
    });
}