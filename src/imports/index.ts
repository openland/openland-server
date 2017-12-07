/// <reference path="../typings.d.ts" />
import { DB } from "../tables/index";
import fetch from "node-fetch";
import { applyBuildingProjects, BuildingProjectDescription, deleteIncorrectProjects } from "../repositories/BuildingProjects";

interface TableResult {
    records: {
        id: string
        fields: {
            [P in string]: number | string | boolean | undefined
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

function parseGeo(src?: string): { latitude: number, longitude: number } | undefined {
    if (src) {
        src = src.trim()
        src = src.substring(1)
        src = src.substring(0, src.length - 1)
        var parts = src.split(',', 2)
        parts[0] = parts[0].trim()
        parts[1] = parts[1].trim()
        var latitude = parseFloat(parts[0])
        var longitude = parseFloat(parts[1])
        return {
            latitude: latitude,
            longitude: longitude
        }
    } else {
        return undefined;
    }
}

function parseString(src?: number | string | boolean | undefined): string | null {
    if (src && typeof (src) == "string") {
        return src
    } else {
        return null
    }
}

// const quarters = [
//     "02-15",
//     "05-15",
//     "08-15",
//     "10-15",
// ]

async function doImport(accountId: number, apiKey: string, database: string) {
    var offset: string | undefined = undefined
    var ids = Array<string>()
    while (true) {
        await DB.tx(async (tx) => {
            var table: TableResult = await fetchTable(apiKey, database, "Pipeline", offset)
            var projects = Array<BuildingProjectDescription>()
            if (!table) {
                offset = undefined
                return
            }
            for (let r of table.records) {
                // console.warn((r.fields))
                // console.warn((r.fields["Existing Units"] as number) + (r.fields["Net Units"] as number))
                // console.warn((r.fields["Existing Units"] as number))
                // console.warn((r.fields["Net Units"] as number))
                // r.fields["Location"] as string

                //console.warn(r.fields["Location"]);
                ids.push(r.fields["Project Id"] as string)
                let geo = parseGeo(r.fields["Location"] as string | undefined);
                projects.push({
                    projectId: r.fields["Project Id"] as string,
                    name: r.fields["Name"] as string,
                    existingUnits: r.fields["Existing Units"] as number,
                    proposedUnits: (r.fields["Existing Units"] as number) + (r.fields["Net Units"] as number),
                    picture: r.fields["Picture Id"] as string,
                    extrasYearEnd: r.fields["Completion Year"] as string,
                    extrasAddress: r.fields["Address"] as string,
                    extrasAddressSecondary: r.fields["Secondary Address"] as string,
                    extrasUrl: parseString(r.fields["URL"]),
                    extrasPermit: r.fields["Permit Id"] as string,
                    extrasDeveloper: r.fields["Developer"] as string,
                    extrasGeneralConstructor: r.fields["General Constuctor"] as string,
                    extrasComment: r.fields["Comments"] as string,
                    verified: r.fields["Verified"] as boolean === true,
                    extrasLatitude: geo !== undefined ? geo.latitude : undefined,
                    extrasLongitude: geo !== undefined ? geo.longitude : undefined
                })
                // console.warn(r.fields["Permit Id"] + " " + r.fields["Name"])
            }
            await applyBuildingProjects(tx, accountId, projects)
            offset = table.offset
        })
        if (!offset) {
            break
        }
        await delay(1000)
    }
    await DB.tx(async (tx) => {
        await deleteIncorrectProjects(tx, accountId, ids)
    });
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