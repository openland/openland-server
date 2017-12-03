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
    var url = "https://api.airtable.com/v0/" + database + "/" + table + "?pageSize=100"
    if (offset) {
        url = url + "&offset=" + offset
    }
    var res = await fetch(url, {
        headers: {
            Authorization: "Bearer " + apiKey
        }
    })
    return (await res.json()) as TableResult
}

const quarters = [
    "02-15",
    "05-15",
    "08-15",
    "10-15",
]

async function doImport(accountId: number, apiKey: string, database: string) {
    var offset: string | undefined = undefined
    while (true) {
        await DB.tx(async (tx) => {
            var table: TableResult = await fetchTable(apiKey, database, "Pipeline", offset)
            var projects = Array<BuildingProjectDescription>()
            for (let r of table.records) {
                projects.push({
                    projectId: r.fields["Permit Id"] as string,
                    name: r.fields["Name"] as string,
                    existingUnits: r.fields["Existing Units"] as number,
                    proposedUnits: (r.fields["Existing Units"] as number) + (r.fields["Net Units"] as number),
                    projectStart: r.fields["Start Year"] + "-" + quarters[(r.fields["Start Quarter"] as number) - 1],
                    projectExpectedCompleted: r.fields["End Year"] + "-" + quarters[(r.fields["End Quarter"] as number) - 1]
                })
                // console.warn(r.fields["Permit Id"] + " " + r.fields["Name"])
            }
            await applyBuildingProjects(tx, accountId, projects)
            offset = table.offset
            console.warn(offset)
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