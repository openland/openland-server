/// <reference path="../typings.d.ts" />
import { DB } from "../tables/index";
import fetch from "node-fetch";
import { applyBuildingProjects, BuildingProjectDescription } from "../repositories/BuildingProjects";

interface TableResult {
    records: {
        id: string
        fields: {
            [P in string]: number | string
        }
    }[]
    offset?: string
}

async function fetchTable(apiKey: string, database: string, table: string, offset?: string): Promise<TableResult> {
    var res = await fetch("https://api.airtable.com/v0/" + database + "/" + table + "?maxRecords=100", {
        headers: {
            Authorization: "Bearer " + apiKey
        }
    })
    return (await res.json()) as TableResult
}

async function doImport(accountId: number, apiKey: string, database: string) {
    var offset: string | undefined = undefined
    while (true) {
        await DB.tx(async (tx) => {
            var table: TableResult = await fetchTable(apiKey, database, "Pipeline", offset)
            var projects = Array<BuildingProjectDescription>()
            for (let r of table.records) {
                projects.push({
                    projectId: r.fields["Permit Id"] as string,
                    name: r.fields["Name"] as string
                })
                // console.warn(r.fields["Permit Id"] + " " + r.fields["Name"])
            }
            await applyBuildingProjects(tx, accountId, projects)
            offset = table.offset
            if (table.offset == null) {
                return
            }
        })
        await delay(1000)
    }
    // let api = new Airtable({ apiKey: apiKey })
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function start() {
    while (true) {
        let allTasks = await DB.AirTable.findAll({ logging: false })

        for (let t of allTasks) {
            try {
                await doImport(t.account, t.airtableKey, t.airtableDatabase)
            } catch (e) {
                console.warn(e)
            }
        }

        await delay(15000)
    }
}

start()