import { tokenExport } from './exportTokens';
import { onlineExport } from './exportOnlines';

const tokenExporter = tokenExport();
const onlineExporter = onlineExport();

export function performMigrations() {
    tokenExporter.start();
    onlineExporter.start();
}