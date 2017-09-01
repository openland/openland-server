import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface ProjectAttributes {
    id?: number;
    name: string;
    account: number;
    slug: string;
    activated?: boolean;
    description?: string;
    intro?: string;
    findings?: string;
    outputs: string;
    sources: string;
    isPrivate: boolean;
    sorting?: string;
}

export interface Project extends sequelize.Instance<ProjectAttributes>, ProjectAttributes { }

export const ProjectTable = connection.define<Project, ProjectAttributes>('projects', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: sequelize.STRING },
    account: {
        type: sequelize.INTEGER, references: {
            model: 'accounts',
            key: 'id',
        }
    },
    slug: { type: sequelize.STRING, unique: true },
    activated: { type: sequelize.BOOLEAN, defaultValue: false },
    description: { type: sequelize.STRING(65536), allowNull: true },
    intro: { type: sequelize.STRING, allowNull: true },
    findings: { type: sequelize.STRING, allowNull: true },
    outputs: { type: sequelize.STRING, allowNull: false, defaultValue: "[]" },
    sources: { type: sequelize.STRING, allowNull: false, defaultValue: "[]" },
    isPrivate: { type: sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    sorting: { type: sequelize.STRING, allowNull: true }
})