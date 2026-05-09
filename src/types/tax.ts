export interface Company {
    id: string;
    name: string;
    rut: string;
    email?: string;
    active: boolean;
    createdAt: string;
}

export type TaxObligationType = 'F29' | 'F22' | 'F50' | 'F1887' | 'F1879' | 'DJ' | 'OTROS';

export const TAX_OBLIGATION_LABELS: Record<TaxObligationType, string> = {
    F29: 'F29 - IVA y PPM (Mensual)',
    F22: 'F22 - Renta Anual',
    F50: 'F50 - Impuestos Retenidos (Mensual)',
    F1887: 'F1887 - DJ Honorarios (Anual)',
    F1879: 'F1879 - Retenciones (Anual)',
    DJ: 'Declaración Jurada',
    OTROS: 'Otros',
};

export interface TaxObligation {
    id: string;
    companyId: string;
    type: TaxObligationType;
    period: string; // "2026-04" mensual o "2026" anual
    dueDate: string; // ISO date
    description?: string;
}

export interface TaxFiling {
    id: string;
    companyId: string;
    obligationId: string;
    type: string;
    period: string;
    filedDate: string;
    folio?: string;
    notes?: string;
}

export interface MissingFiling {
    company: Company;
    obligation: TaxObligation;
    daysOverdue: number;
    isOverdue: boolean;
}

export interface TaxReport {
    generatedAt: string;
    period: string;
    missing: MissingFiling[];
    filedCount: number;
    totalObligations: number;
    companiesWithMissing: string[];
}
