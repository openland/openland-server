import { DB } from './tables'
export async function InitSampleData() {
    await DB.User.create({
        authId: "facebook|10213268338843701"
    })
    await DB.City.create({
        name: "San Francisco"
    })
}