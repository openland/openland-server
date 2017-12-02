import { DB } from "../tables/index";
import { bulkApply } from "../utils/db_utils";

export interface BuildingProjectDescription {
    projectId: string
    permitId?: string
    name?: string
}

export async function applyBuildingProjects(accountId: number, projects: BuildingProjectDescription[]) {
    // await DB.BuidlingProject.destroy({
    //     where: {
    //         account: accountId
    //     }
    // });

    var values = projects.map(p => ({ projectId: p.projectId, name: p.name }))
    await bulkApply(DB.BuidlingProject, accountId, 'projectId', values)
    //await bulkInsert(DB.BuidlingProject, values)
    // for (let p of projects) {


    // let existing = await DB.BuidlingProject.findOne({
    //     where: {
    //         account: accountId,
    //         projectId: p.projectId
    //     },
    //     logging: false
    // })
    // if (!existing) {
    //     await DB.BuidlingProject.create({
    //         account: accountId,
    //         projectId: p.projectId,
    //         name: p.name,
    //     }, { logging: false })
    // } else {
    //     if (p.name) {
    //         existing.name = p.name
    //     }
    //     // if (p.description) {
    //     //     existing.description = p.description
    //     // }
    //     // if (p.verified) {
    //     //     existing.verified = p.verified
    //     // }
    //     // if (p.existingUnits) {
    //     //     existing.existingUnits = p.existingUnits
    //     // }
    //     // if (p.proposedUnits) {
    //     //     existing.proposedUnits = p.proposedUnits
    //     // }
    //     // if (p.existingAffordableUnits) {
    //     //     existing.existingAffordableUnits = p.existingAffordableUnits
    //     // }
    //     // if (p.proposedAffordableUnits) {
    //     //     existing.proposedAffordableUnits = p.proposedAffordableUnits
    //     // }
    //     await existing.save()
    // }
    // }
}