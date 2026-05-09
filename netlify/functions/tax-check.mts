import type { Config } from '@netlify/functions';
import { generateAndSaveReport } from '../../src/lib/taxStore.js';

// Runs every 6 hours: 00:00, 06:00, 12:00, 18:00 UTC
export const config: Config = {
    schedule: '0 */6 * * *',
};

export default async (): Promise<Response> => {
    const report = await generateAndSaveReport();

    const summary = {
        generatedAt: report.generatedAt,
        totalObligations: report.totalObligations,
        filed: report.filedCount,
        missing: report.missing.length,
        overdue: report.missing.filter((m) => m.isOverdue).length,
        companiesWithMissing: report.companiesWithMissing,
        missingList: report.missing.map((m) => ({
            empresa: m.company.name,
            rut: m.company.rut,
            tipo: m.obligation.type,
            periodo: m.obligation.period,
            vencimiento: m.obligation.dueDate,
            diasAtraso: m.daysOverdue,
            atrasado: m.isOverdue,
        })),
    };

    if (summary.missing > 0) {
        console.log(
            `[tax-check] REPORTE: ${summary.missing} declaraciones pendientes en ${summary.companiesWithMissing.length} empresa(s)`,
        );
        console.log('[tax-check] Detalle faltantes:');
        for (const item of summary.missingList) {
            const status = item.atrasado ? `ATRASADO ${item.diasAtraso} días` : 'PENDIENTE';
            console.log(
                `  - ${item.empresa} (${item.rut}): ${item.tipo} ${item.periodo} | Vence ${item.vencimiento} | ${status}`,
            );
        }
    } else {
        console.log('[tax-check] Todo al día. No hay declaraciones pendientes.');
    }

    return Response.json(summary);
};
