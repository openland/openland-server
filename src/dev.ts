import { DB } from './tables'
export async function InitSampleData() {
    await DB.User.create({
        authId: "facebook|10213268338843701"
    })
    var sf = await DB.City.create({
        name: "San Francisco",
        slug: "sf",
        activated: true
    })
    await DB.City.create({
        name: "New York",
        slug: "nyc"
    })
    var sec = await DB.Sector.create({
        name: "Housing"
    })
    await DB.SectorActivation.create({
        sectorId: sec.id!!,
        cityId: sf.id!!
    })
}