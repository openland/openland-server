import { QueryInterface, DataTypes } from 'sequelize';
import { DB } from '../index';
import * as fs from 'fs';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {

    // Load All
    let allCities = JSON.parse(fs.readFileSync("./src/tables/data/cities.json", { encoding: 'utf8' })) as { City: string, State: string, County: string }[]

    // Drop Code from Counties
    await queryInterface.removeIndex('counties', ['stateId', 'code'])
    await queryInterface.removeColumn('counties', 'code')
    await queryInterface.addIndex('counties', ['stateId', 'name'], { indicesType: 'UNIQUE' })

    // Import All Counties
    let allStates = await DB.State.findAll()
    let processedCounties = new Set<string>();
    let allCounties = Array<{ name: string, stateId: number }>();
    allCities.forEach((p) => {
        if (!processedCounties.has(p.State + "|" + p.County)) {
            processedCounties.add(p.State + "|" + p.County)

            let id = allStates.find((s) => s.code!!.toUpperCase() == p.State.toUpperCase())!!.id!!
            if (id) {
                allCounties.push({
                    name: p.County,
                    stateId: id
                })
            }
        }
    })
    await DB.County.bulkCreate(allCounties)

    // Import ALl Cities
    let importedCounties = await DB.County.findAll()
    let processedCities = new Set<string>();
    let allCitiesImport = new Array<{ name: string, countyId: number }>();
    for (let p of allCities) {
        if (!processedCities.has(p.State + "|" + p.County + "|" + p.City)) {
            processedCities.add(p.State + "|" + p.County + "|" + p.City)
            let stateId = allStates.find((s) => s.code!!.toUpperCase() == p.State.toUpperCase())
            if (stateId) {
                let id = importedCounties.find((s) => s.stateId == stateId!!.id!! && s.name == p.County);
                if (id) {
                    allCitiesImport.push({
                        name: p.City,
                        countyId: id.id!!
                    })
                    if (allCitiesImport.length > 100) {
                        await DB.City.bulkCreate(allCitiesImport)
                        allCitiesImport = []
                    }
                }
            }
        }
    }

    if (allCitiesImport.length > 0) {
        await DB.City.bulkCreate(allCitiesImport)
    }
}

export async function down(queryInterface: QueryInterface, sequelize: DataTypes) {

}