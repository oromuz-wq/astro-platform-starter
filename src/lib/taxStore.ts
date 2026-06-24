import { getStore } from '@netlify/blobs';
import type { Company, TaxObligation, TaxFiling, MissingFiling, TaxReport } from '../types/tax.js';

const STORE_NAME = 'tax-tracker';
const COMPANIES_KEY = 'companies';
const OBLIGATIONS_KEY = 'obligations';
const FILINGS_KEY = 'filings';
const REPORT_KEY = 'last-report';

function store() {
    return getStore(STORE_NAME);
}

export async function getCompanies(): Promise<Company[]> {
    return (await store().get(COMPANIES_KEY, { type: 'json' })) ?? [];
}

export async function saveCompanies(companies: Company[]): Promise<void> {
    await store().setJSON(COMPANIES_KEY, companies);
}

export async function getObligations(): Promise<TaxObligation[]> {
    return (await store().get(OBLIGATIONS_KEY, { type: 'json' })) ?? [];
}

export async function saveObligations(obligations: TaxObligation[]): Promise<void> {
    await store().setJSON(OBLIGATIONS_KEY, obligations);
}

export async function getFilings(): Promise<TaxFiling[]> {
    return (await store().get(FILINGS_KEY, { type: 'json' })) ?? [];
}

export async function saveFilings(filings: TaxFiling[]): Promise<void> {
    await store().setJSON(FILINGS_KEY, filings);
}

export async function getLastReport(): Promise<TaxReport | null> {
    return (await store().get(REPORT_KEY, { type: 'json' })) ?? null;
}

export async function generateAndSaveReport(): Promise<TaxReport> {
    const [companies, obligations, filings] = await Promise.all([
        getCompanies(),
        getObligations(),
        getFilings(),
    ]);

    const activeCompanies = companies.filter((c) => c.active);
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const filedIds = new Set(filings.map((f) => f.obligationId));

    const missing: MissingFiling[] = [];

    for (const obligation of obligations) {
        if (filedIds.has(obligation.id)) continue;
        const company = activeCompanies.find((c) => c.id === obligation.companyId);
        if (!company) continue;

        const dueDate = new Date(obligation.dueDate);
        const diffMs = now.getTime() - dueDate.getTime();
        const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        missing.push({
            company,
            obligation,
            daysOverdue: Math.max(0, daysOverdue),
            isOverdue: dueDate < now,
        });
    }

    // Sort: overdue first, then by due date ascending
    missing.sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return new Date(a.obligation.dueDate).getTime() - new Date(b.obligation.dueDate).getTime();
    });

    const report: TaxReport = {
        generatedAt: now.toISOString(),
        period: currentPeriod,
        missing,
        filedCount: filings.length,
        totalObligations: obligations.length,
        companiesWithMissing: [...new Set(missing.map((m) => m.company.name))],
    };

    await store().setJSON(REPORT_KEY, report);
    return report;
}
