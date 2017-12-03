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

// const quarters = [
//     "02-15",
//     "05-15",
//     "08-15",
//     "10-15",
// ]

async function doImport(accountId: number, apiKey: string, database: string) {
    var offset: string | undefined = undefined
    while (true) {
        await DB.tx(async (tx) => {
            var table: TableResult = await fetchTable(apiKey, database, "Pipeline", offset)
            var projects = Array<BuildingProjectDescription>()
            if (!table) {
                return
            }
            for (let r of table.records) {
                // console.warn((r.fields))
                // console.warn((r.fields["Existing Units"] as number) + (r.fields["Net Units"] as number))
                // console.warn((r.fields["Existing Units"] as number))
                // console.warn((r.fields["Net Units"] as number))
                projects.push({
                    projectId: r.fields["Project Id"] as string,
                    name: r.fields["Name"] as string,
                    existingUnits: r.fields["Existing Units"] as number,
                    proposedUnits: (r.fields["Existing Units"] as number) + (r.fields["Net Units"] as number),
                    picture: r.fields["Picture Id"] as string,
                    extrasYearEnd: r.fields["Completion Year"] as string,
                    extrasAddress: r.fields["Address"] as string,
                    extrasAddressSecondary: r.fields["Secondary Address"] as string,
                    extrasUrl: r.fields["URL"] as string,
                    extrasPermit: r.fields["Permit Id"] as string,
                    extrasDeveloper: r.fields["Developer"] as string,
                    extrasGeneralConstructor: r.fields["General Constuctor"] as string,
                    extrasComment: r.fields["Comments"] as string
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