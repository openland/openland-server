import { DB, Developer } from '../tables';
import { bulkApply } from '../utils/db_utils';
import { Transaction } from 'sequelize';
import { NotFoundError } from '../errors/NotFoundError';
import { ErrorText } from '../errors/ErrorText';

export interface BuildingProjectDescription {
    projectId: string;
    govId?: string;
    name?: string;
    existingUnits?: number;
    proposedUnits?: number;
    projectStart?: string;
    projectExpectedCompleted?: string;
    description?: string;

    picture?: string;

    extrasDeveloper?: string | null;
    extrasGeneralConstructor?: string | null;
    extrasYearEnd?: string | null;
    extrasAddress?: string | null;
    extrasAddressSecondary?: string | null;
    extrasPermit?: string | null;
    extrasComment?: string | null;
    extrasUrl?: string | null;
    extrasLatitude?: number;
    extrasLongitude?: number;

    developers?: string[];
    constructors?: string[];
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
    });
}

export async function applyBuildingProjects(tx: Transaction, accountId: number, projects: BuildingProjectDescription[]) {

    //
    // Main Records
    //

    let values = projects.map(p => {
        return {
            projectId: p.projectId,
            govId: p.govId,
            name: p.name,
            projectStartedAt: p.projectStart,
            projectExpectedCompletedAt: p.projectExpectedCompleted,
            existingUnits: p.existingUnits,
            proposedUnits: p.proposedUnits,
            picture: p.picture,
            description: p.description,

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
        };
    });
    let applied = await bulkApply(tx, DB.BuidlingProject, accountId, 'projectId', values);

    //
    // Load Developers
    //

    let developerSet = new Set<string>();
    projects.forEach((p) => {
        if (p.developers) {
            p.developers.forEach((d) => {
                developerSet.add(d.toLowerCase());
            });
        }
        if (p.constructors) {
            p.constructors.forEach((d) => {
                developerSet.add(d.toLowerCase());
            });
        }
    });
    let allDevelopers = Array.from(developerSet);
    let developers: { [key: string]: Developer } = {};
    if (allDevelopers.length > 0) {
        (await DB.Developer.findAll({
            where: {
                account: accountId,
                slug: {
                    $in: allDevelopers
                }
            },
            transaction: tx,
            logging: false
        })).forEach((d) => {
            developers[d.slug!!] = d;
        });
    }

    // Apply Associations

    let index = 0;
    for (let p of applied) {
        let bp = (await DB.BuidlingProject.findOne({
            where: { id: p.id },
            transaction: tx,
            logging: false
        }))!!;
        let src = projects[index];

        if (src.developers) {
            await bp.setDevelopers(src.developers.map((d) => {
                if (developers[d.toLowerCase()] === undefined) {
                    throw new NotFoundError(ErrorText.unableToFindOrganizationNamed(d.toLocaleLowerCase()));
                }
                return developers[d.toLowerCase()]!!;
            }), { transaction: tx, logging: false });
        } else {
            await bp.setDevelopers([], { transaction: tx, logging: false });
        }

        if (src.constructors) {
            await bp.setConstructors(src.constructors.map((d) => {
                if (developers[d.toLowerCase()] === undefined) {
                    throw new NotFoundError(ErrorText.unableToFindOrganizationNamed(d.toLocaleLowerCase()));
                }
                return developers[d.toLowerCase()]!!;
            }), { transaction: tx, logging: false });
        } else {
            await bp.setConstructors([], { transaction: tx, logging: false });
        }

        if (src.permits) {
            let ex = await DB.Permit.findAll({
                where: {
                    account: accountId,
                    permitId: {
                        $in: src.permits
                    }
                },
                transaction: tx,
                logging: false
            });
            await bp.setPermits(ex, { transaction: tx, logging: false });
        } else {
            await bp.setPermits([], { transaction: tx, logging: false });
        }

        index++;
    }
}