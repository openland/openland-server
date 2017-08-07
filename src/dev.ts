import { DB } from './tables'
export async function InitSampleData() {
    await DB.User.create({
        authId: "facebook|10213268338843701",
        firstName: "Stepan",
        lastName: "Korshakov",
        email: "korshakov.stepan@gmail.com",
        picture: "https://scontent.xx.fbcdn.net/v/t1.0-1/p50x50/12799449_10208337398773281_8543476314381451147_n.jpg?oh=f5e1fb63405ecf5dc1f88950fdcb4257&oe=5A2F17E5"
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