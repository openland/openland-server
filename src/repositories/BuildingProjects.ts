import { DB } from "../tables/index";
import { bulkApply } from "../utils/db_utils";
import { Transaction } from "sequelize";
import { BuildingProjectAttributes } from "../tables/BuildingProject";

export interface BuildingProjectDescription {
    projectId: string
    permitId?: string
    name?: string
    existingUnits?: number
    proposedUnits?: number
    projectStart?: string
    projectExpectedCompleted?: string
}

export async function applyBuildingProjects(tx: Transaction, accountId: number, projects: BuildingProjectDescription[]) {
    // await DB.BuidlingProject.destroy({
    //     where: {
    //         account: accountId
    //     }
    // });

    var values = projects.map(p => {
        var res: BuildingProjectAttributes = {
            projectId: p.projectId,
            name: p.name,
            projectStartedAt: p.projectStart,
            projectExpectedCompletedAt: p.projectExpectedCompleted,
            existingUnits: p.existingUnits,
            proposedUnits: p.proposedUnits
        }
        return res
    })
    await bulkApply(tx, DB.BuidlingProject, accountId, 'projectId', values)
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