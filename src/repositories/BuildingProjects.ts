import { DB, Developer } from "../tables/index";
import { bulkApply } from "../utils/db_utils";
import { Transaction } from "sequelize";
import { BuildingProjectAttributes } from "../tables/BuildingProject";

export interface BuildingProjectDescription {
    projectId: string
    permitId?: string
    govId?: string
    name?: string
    existingUnits?: number
    proposedUnits?: number
    projectStart?: string
    projectExpectedCompleted?: string

    picture?: string;

    extrasDeveloper?: string | null
    extrasGeneralConstructor?: string | null
    extrasYearEnd?: string | null
    extrasAddress?: string | null
    extrasAddressSecondary?: string | null
    extrasPermit?: string | null
    extrasComment?: string | null
    extrasUrl?: string | null
    extrasLatitude?: number;
    extrasLongitude?: number;

    developers?: string[];
    permits?: string[];

    verified?: boolean;
}

export async function deleteIncorrectProjects(tx: Transaction, accountId: number, id: string[]) {
    await DB.BuidlingProject.destroy({
        where: {
            account: accountId,
            projectId: {
                $notIn: id
            }
        },
        transaction: tx
    })
}

export async function applyBuildingProjects(tx: Transaction, accountId: number, projects: BuildingProjectDescription[]) {

    //
    // Main Records
    //

    var values = projects.map(p => {
        var res: BuildingProjectAttributes = {
            projectId: p.projectId,
            govId: p.govId,
            name: p.name,
            projectStartedAt: p.projectStart,
            projectExpectedCompletedAt: p.projectExpectedCompleted,
            existingUnits: p.existingUnits,
            proposedUnits: p.proposedUnits,
            picture: p.picture,

            extrasDeveloper: p.extrasDeveloper,
            extrasGeneralConstructor: p.extrasGeneralConstructor,
            extrasYearEnd: p.extrasYearEnd,
            extrasAddress: p.extrasAddress,
            extrasAddressSecondary: p.extrasAddressSecondary,
            extrasPermit: p.extrasPermit,
            extrasComment: p.extrasComment,
            extrasUrl: p.extrasUrl,

            extrasLatitude: p.extrasLatitude,
            extrasLongitude: p.extrasLongitude,

            verified: p.verified
        }
        return res
    })
    let applied = await bulkApply(tx, DB.BuidlingProject, accountId, 'projectId', values)

    //
    // Developers
    //

    var developerSet = new Set<string>();
    projects.forEach((p) => {
        if (p.developers) {
            p.developers.forEach((d) => {
                developerSet.add(d.toLowerCase());
            })
        }
    });
    let allDevelopers = Array.from(developerSet);
    var developers: { [key: string]: Developer } = {};
    if (allDevelopers.length > 0) {
        (await DB.Developer.findAll({
            where: {
                account: accountId,
                slug: {
                    $in: allDevelopers
                }
            },
            transaction: tx
        })).forEach((d) => {
            developers[d.slug!!] = d;
        })
    }

    var index = 0
    for (let p of applied) {
        let bp = (await DB.BuidlingProject.findOne({
            where: { id: p.id },
            transaction: tx,
            logging: false
        }))!!
        let src = projects[index];
        if (src.developers) {
            await bp.setDevelopers!!(src.developers.map((d) => {
                return developers[d.toLowerCase()]!!
            }), { transaction: tx, logging: false });
        } else {
            await bp.setDevelopers!!([], { transaction: tx, logging: false });
        }

        index++;
    }
}