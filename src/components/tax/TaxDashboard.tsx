import { useState, useEffect, useCallback } from 'react';
import type { TaxReport, MissingFiling } from '../../types/tax.js';
import { TAX_OBLIGATION_LABELS } from '../../types/tax.js';

interface FilingModal {
    missing: MissingFiling;
    folio: string;
    notes: string;
    submitting: boolean;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatPeriod(period: string) {
    if (period.length === 7) {
        const [y, m] = period.split('-');
        const months = [
            'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
            'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
        ];
        return `${months[parseInt(m) - 1]} ${y}`;
    }
    return period;
}

export default function TaxDashboard() {
    const [report, setReport] = useState<TaxReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modal, setModal] = useState<FilingModal | null>(null);
    const [successMsg, setSuccessMsg] = useState('');

    const fetchReport = useCallback(async (forceRefresh = false) => {
        try {
            const url = forceRefresh
                ? '/api/tax/report?refresh=true'
                : '/api/tax/report';
            const res = await fetch(url);
            const data: TaxReport = await res.json();
            setReport(data);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchReport(true);
    };

    const handleMarkFiled = async () => {
        if (!modal) return;
        setModal((m) => m && { ...m, submitting: true });

        const res = await fetch('/api/tax/filings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                obligationId: modal.missing.obligation.id,
                companyId: modal.missing.company.id,
                folio: modal.folio || undefined,
                notes: modal.notes || undefined,
            }),
        });

        if (res.ok) {
            setModal(null);
            setSuccessMsg(
                `✓ ${modal.missing.company.name} — ${TAX_OBLIGATION_LABELS[modal.missing.obligation.type as keyof typeof TAX_OBLIGATION_LABELS] ?? modal.missing.obligation.type} marcado como presentado`,
            );
            setTimeout(() => setSuccessMsg(''), 4000);
            fetchReport(true);
        } else {
            const err = await res.json();
            alert(err.error ?? 'Error al registrar presentación');
            setModal((m) => m && { ...m, submitting: false });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-gray-400">
                Cargando reporte...
            </div>
        );
    }

    if (!report) {
        return (
            <div className="py-10 text-center text-gray-400">
                No hay datos. Agrega empresas y obligaciones primero.
            </div>
        );
    }

    const overdue = report.missing.filter((m) => m.isOverdue);
    const pending = report.missing.filter((m) => !m.isOverdue);

    const byCompany = report.missing.reduce<Record<string, MissingFiling[]>>((acc, m) => {
        const key = m.company.id;
        if (!acc[key]) acc[key] = [];
        acc[key].push(m);
        return acc;
    }, {});

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="mt-1 text-sm text-gray-400">
                        Última revisión:{' '}
                        {new Date(report.generatedAt).toLocaleString('es-CL', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                        })}
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="btn"
                    style={{ '--btn-py': '0.5rem', '--btn-px': '1rem' } as React.CSSProperties}
                >
                    {refreshing ? 'Actualizando...' : '↻ Actualizar ahora'}
                </button>
            </div>

            {successMsg && (
                <div className="rounded-lg bg-green-800/40 border border-green-600 px-4 py-3 text-green-300 text-sm">
                    {successMsg}
                </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Total Obligaciones" value={report.totalObligations} color="text-white" />
                <StatCard label="Presentadas" value={report.filedCount} color="text-green-400" />
                <StatCard label="Pendientes" value={pending.length} color="text-yellow-400" />
                <StatCard label="Atrasadas" value={overdue.length} color="text-red-400" />
            </div>

            {/* Missing filings */}
            {report.missing.length === 0 ? (
                <div className="rounded-xl border border-green-700 bg-green-900/20 px-6 py-8 text-center">
                    <div className="text-3xl">✓</div>
                    <p className="mt-2 font-semibold text-green-400">
                        Todo al día — no hay declaraciones pendientes
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    <h2 className="text-xl font-bold">
                        Declaraciones Pendientes
                        <span className="ml-2 text-base font-normal text-gray-400">
                            ({report.missing.length} en total)
                        </span>
                    </h2>

                    {Object.values(byCompany).map((items) => {
                        const company = items[0].company;
                        return (
                            <div
                                key={company.id}
                                className="rounded-xl border border-white/10 bg-white/5 overflow-hidden"
                            >
                                <div className="flex items-center justify-between px-4 py-3 bg-white/5">
                                    <div>
                                        <span className="font-semibold">{company.name}</span>
                                        <span className="ml-2 text-xs text-gray-400">
                                            RUT {company.rut}
                                        </span>
                                    </div>
                                    <span className="text-xs rounded-full bg-red-900/50 text-red-300 px-2 py-0.5 border border-red-700">
                                        {items.length} pendiente{items.length !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                <div className="divide-y divide-white/5">
                                    {items.map((item) => (
                                        <ObligationRow
                                            key={item.obligation.id}
                                            item={item}
                                            onMarkFiled={() =>
                                                setModal({
                                                    missing: item,
                                                    folio: '',
                                                    notes: '',
                                                    submitting: false,
                                                })
                                            }
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Filing modal */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
                    <div className="w-full max-w-md rounded-xl border border-white/20 bg-gray-900 p-6 space-y-4">
                        <h3 className="text-lg font-bold">Registrar Presentación</h3>
                        <div className="text-sm text-gray-300 space-y-1">
                            <p>
                                <span className="text-gray-500">Empresa:</span>{' '}
                                {modal.missing.company.name}
                            </p>
                            <p>
                                <span className="text-gray-500">Tipo:</span>{' '}
                                {TAX_OBLIGATION_LABELS[modal.missing.obligation.type as keyof typeof TAX_OBLIGATION_LABELS] ??
                                    modal.missing.obligation.type}
                            </p>
                            <p>
                                <span className="text-gray-500">Periodo:</span>{' '}
                                {formatPeriod(modal.missing.obligation.period)}
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">
                                    N° Folio SII (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={modal.folio}
                                    onChange={(e) =>
                                        setModal((m) => m && { ...m, folio: e.target.value })
                                    }
                                    placeholder="Ej: 12345678"
                                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">
                                    Notas (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={modal.notes}
                                    onChange={(e) =>
                                        setModal((m) => m && { ...m, notes: e.target.value })
                                    }
                                    placeholder="Observaciones..."
                                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleMarkFiled}
                                disabled={modal.submitting}
                                className="btn flex-1"
                            >
                                {modal.submitting ? 'Guardando...' : '✓ Marcar como Presentado'}
                            </button>
                            <button
                                onClick={() => setModal(null)}
                                className="rounded-lg border border-white/20 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({
    label,
    value,
    color,
}: {
    label: string;
    value: number;
    color: string;
}) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
    );
}

function ObligationRow({
    item,
    onMarkFiled,
}: {
    item: MissingFiling;
    onMarkFiled: () => void;
}) {
    const label =
        TAX_OBLIGATION_LABELS[item.obligation.type as keyof typeof TAX_OBLIGATION_LABELS] ??
        item.obligation.type;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="space-y-0.5">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-gray-400">
                    Periodo: {formatPeriod(item.obligation.period)} · Vence:{' '}
                    {formatDate(item.obligation.dueDate)}
                    {item.obligation.description && ` · ${item.obligation.description}`}
                </p>
            </div>

            <div className="flex items-center gap-3">
                {item.isOverdue ? (
                    <span className="text-xs font-medium text-red-400">
                        {item.daysOverdue} día{item.daysOverdue !== 1 ? 's' : ''} atrasado
                    </span>
                ) : (
                    <span className="text-xs font-medium text-yellow-400">Pendiente</span>
                )}
                <button
                    onClick={onMarkFiled}
                    className="text-xs rounded-lg bg-primary/20 border border-primary/40 text-primary px-3 py-1.5 hover:bg-primary/30 transition-colors whitespace-nowrap"
                >
                    Marcar presentado
                </button>
            </div>
        </div>
    );
}
