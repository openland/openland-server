import { tokenExport } from './exportTokens';

const tokenExporter = tokenExport();

export function performMigrations() {
    tokenExporter.start();
}