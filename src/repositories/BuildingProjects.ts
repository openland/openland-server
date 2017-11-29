import { DB } from "../tables/index";

export interface BuildingProjectDescription {
    projectId: string
    permitId?: string
    name?: string
}

export async function applyBuildingProjects(accountId: number, projects: BuildingProjectDescription[]) {
    for (let p of projects) {
        let existing = await DB.BuidlingProject.findOne({
            where: {
                account: accountId,
                projectId: p.projectId
            },
            logging: false
        })
        if (!existing) {
            await DB.BuidlingProject.create({
                account: accountId,
                projectId: p.projectId,
                name: p.name,
            }, { logging: false })
        } else {
            if (p.name) {
                existing.name = p.name
            }
            // if (p.description) {
            //     existing.description = p.description
            // }
            // if (p.verified) {
            //     existing.verified = p.verified
            // }
            // if (p.existingUnits) {
            //     existing.existingUnits = p.existingUnits
            // }
            // if (p.proposedUnits) {
            //     existing.proposedUnits = p.proposedUnits
            // }
            // if (p.existingAffordableUnits) {
            //     existing.existingAffordableUnits = p.existingAffordableUnits
            // }
            // if (p.proposedAffordableUnits) {
            //     existing.proposedAffordableUnits = p.proposedAffordableUnits
            // }
            await existing.save()
        }
    }
}