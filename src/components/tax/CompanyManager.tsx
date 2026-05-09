import { useState, useEffect } from 'react';
import type { Company, TaxObligation, TaxObligationType } from '../../types/tax.js';
import { TAX_OBLIGATION_LABELS } from '../../types/tax.js';

const OBLIGATION_TYPES = Object.keys(TAX_OBLIGATION_LABELS) as TaxObligationType[];

// Compute default due date for a given type and period
function defaultDueDate(type: TaxObligationType, period: string): string {
    if (period.length === 7) {
        // Monthly: due on 20th of following month
        const [year, month] = period.split('-').map(Number);
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        return `${nextYear}-${String(nextMonth).padStart(2, '0')}-20`;
    }
    // Annual: F22 due April 30, others March 31
    if (type === 'F22') return `${period}-04-30`;
    return `${period}-03-31`;
}

function currentPeriod() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface ObligationWithFiling extends TaxObligation {
    filed: boolean;
}

export default function CompanyManager() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [obligations, setObligations] = useState<Record<string, ObligationWithFiling[]>>({});
    const [newCompany, setNewCompany] = useState({ name: '', rut: '', email: '' });
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');

    const [newObligation, setNewObligation] = useState<{
        type: TaxObligationType;
        period: string;
        dueDate: string;
        description: string;
    }>({
        type: 'F29',
        period: currentPeriod(),
        dueDate: defaultDueDate('F29', currentPeriod()),
        description: '',
    });
    const [addingObligation, setAddingObligation] = useState(false);

    useEffect(() => {
        fetchCompanies();
    }, []);

    async function fetchCompanies() {
        const res = await fetch('/api/tax/companies');
        const data: Company[] = await res.json();
        setCompanies(data);
        setLoading(false);
    }

    async function fetchObligations(companyId: string) {
        const [obsRes, filingsRes] = await Promise.all([
            fetch(`/api/tax/obligations?companyId=${companyId}`),
            fetch(`/api/tax/filings?companyId=${companyId}`),
        ]);
        const obs: TaxObligation[] = await obsRes.json();
        const filings: { obligationId: string }[] = await filingsRes.json();
        const filedIds = new Set(filings.map((f) => f.obligationId));
        setObligations((prev) => ({
            ...prev,
            [companyId]: obs.map((o) => ({ ...o, filed: filedIds.has(o.id) })),
        }));
    }

    function handleExpandCompany(id: string) {
        if (expandedId === id) {
            setExpandedId(null);
            return;
        }
        setExpandedId(id);
        fetchObligations(id);
    }

    async function handleAddCompany(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setAdding(true);
        try {
            const res = await fetch('/api/tax/companies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCompany),
            });
            if (res.ok) {
                setNewCompany({ name: '', rut: '', email: '' });
                fetchCompanies();
            } else {
                const err = await res.json();
                setError(err.error ?? 'Error al agregar empresa');
            }
        } finally {
            setAdding(false);
        }
    }

    async function handleToggleActive(company: Company) {
        await fetch('/api/tax/companies', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: company.id, active: !company.active }),
        });
        fetchCompanies();
    }

    async function handleDeleteCompany(id: string) {
        if (!confirm('¿Eliminar esta empresa y todas sus obligaciones?')) return;
        await fetch(`/api/tax/companies?id=${id}`, { method: 'DELETE' });
        setExpandedId(null);
        fetchCompanies();
    }

    async function handleAddObligation(companyId: string) {
        setAddingObligation(true);
        try {
            const res = await fetch('/api/tax/obligations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId, ...newObligation }),
            });
            if (res.ok) {
                fetchObligations(companyId);
                setNewObligation({
                    type: 'F29',
                    period: currentPeriod(),
                    dueDate: defaultDueDate('F29', currentPeriod()),
                    description: '',
                });
            } else {
                const err = await res.json();
                alert(err.error ?? 'Error al agregar obligación');
            }
        } finally {
            setAddingObligation(false);
        }
    }

    async function handleDeleteObligation(obligationId: string, companyId: string) {
        if (!confirm('¿Eliminar esta obligación?')) return;
        await fetch(`/api/tax/obligations?id=${obligationId}`, { method: 'DELETE' });
        fetchObligations(companyId);
    }

    if (loading) {
        return <div className="py-10 text-center text-gray-400">Cargando empresas...</div>;
    }

    return (
        <div className="space-y-8">
            {/* Add company form */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-bold mb-4">Agregar Empresa</h2>
                <form onSubmit={handleAddCompany} className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">
                                Razón Social *
                            </label>
                            <input
                                required
                                type="text"
                                value={newCompany.name}
                                onChange={(e) =>
                                    setNewCompany((p) => ({ ...p, name: e.target.value }))
                                }
                                placeholder="Empresa S.A."
                                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">RUT *</label>
                            <input
                                required
                                type="text"
                                value={newCompany.rut}
                                onChange={(e) =>
                                    setNewCompany((p) => ({ ...p, rut: e.target.value }))
                                }
                                placeholder="12.345.678-9"
                                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Email</label>
                            <input
                                type="email"
                                value={newCompany.email}
                                onChange={(e) =>
                                    setNewCompany((p) => ({ ...p, email: e.target.value }))
                                }
                                placeholder="contacto@empresa.cl"
                                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                            />
                        </div>
                    </div>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    <button type="submit" disabled={adding} className="btn">
                        {adding ? 'Guardando...' : '+ Agregar Empresa'}
                    </button>
                </form>
            </div>

            {/* Companies list */}
            <div className="space-y-3">
                <h2 className="text-lg font-bold">
                    Empresas ({companies.length})
                </h2>

                {companies.length === 0 && (
                    <p className="text-gray-400 text-sm">
                        No hay empresas registradas. Agrega la primera.
                    </p>
                )}

                {companies.map((company) => (
                    <div
                        key={company.id}
                        className="rounded-xl border border-white/10 bg-white/5 overflow-hidden"
                    >
                        {/* Company row */}
                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                            <div>
                                <span
                                    className={`font-semibold ${!company.active ? 'text-gray-500' : ''}`}
                                >
                                    {company.name}
                                </span>
                                <span className="ml-2 text-xs text-gray-400">
                                    RUT {company.rut}
                                </span>
                                {company.email && (
                                    <span className="ml-2 text-xs text-gray-500">
                                        · {company.email}
                                    </span>
                                )}
                                {!company.active && (
                                    <span className="ml-2 text-xs text-gray-600">(Inactiva)</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleExpandCompany(company.id)}
                                    className="text-xs rounded-lg border border-white/20 px-3 py-1.5 hover:bg-white/10 transition-colors"
                                >
                                    {expandedId === company.id
                                        ? '▲ Cerrar'
                                        : '▼ Obligaciones'}
                                </button>
                                <button
                                    onClick={() => handleToggleActive(company)}
                                    className="text-xs rounded-lg border border-white/20 px-3 py-1.5 hover:bg-white/10 transition-colors"
                                >
                                    {company.active ? 'Desactivar' : 'Activar'}
                                </button>
                                <button
                                    onClick={() => handleDeleteCompany(company.id)}
                                    className="text-xs rounded-lg border border-red-900 text-red-400 px-3 py-1.5 hover:bg-red-900/20 transition-colors"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>

                        {/* Obligations panel */}
                        {expandedId === company.id && (
                            <div className="border-t border-white/10 bg-black/20 p-4 space-y-4">
                                <h3 className="text-sm font-semibold text-gray-300">
                                    Obligaciones registradas
                                </h3>

                                {(obligations[company.id] ?? []).length === 0 ? (
                                    <p className="text-xs text-gray-500">
                                        No hay obligaciones. Agrega una abajo.
                                    </p>
                                ) : (
                                    <div className="space-y-1">
                                        {(obligations[company.id] ?? []).map((ob) => (
                                            <div
                                                key={ob.id}
                                                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 bg-white/5"
                                            >
                                                <div className="text-xs">
                                                    <span className="font-medium">
                                                        {TAX_OBLIGATION_LABELS[ob.type] ?? ob.type}
                                                    </span>
                                                    <span className="ml-2 text-gray-400">
                                                        Periodo: {ob.period} · Vence:{' '}
                                                        {new Date(ob.dueDate).toLocaleDateString(
                                                            'es-CL',
                                                        )}
                                                    </span>
                                                    {ob.description && (
                                                        <span className="ml-2 text-gray-500">
                                                            · {ob.description}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {ob.filed ? (
                                                        <span className="text-xs text-green-400">
                                                            ✓ Presentada
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-yellow-400">
                                                            Pendiente
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() =>
                                                            handleDeleteObligation(
                                                                ob.id,
                                                                company.id,
                                                            )
                                                        }
                                                        className="text-xs text-red-400 hover:text-red-300"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add obligation form */}
                                <div className="pt-2 border-t border-white/10">
                                    <p className="text-xs font-semibold text-gray-400 mb-3">
                                        Agregar obligación
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">
                                                Tipo
                                            </label>
                                            <select
                                                value={newObligation.type}
                                                onChange={(e) => {
                                                    const type = e.target
                                                        .value as TaxObligationType;
                                                    setNewObligation((p) => ({
                                                        ...p,
                                                        type,
                                                        dueDate: defaultDueDate(
                                                            type,
                                                            p.period,
                                                        ),
                                                    }));
                                                }}
                                                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2 py-1.5 text-xs text-white focus:outline-none"
                                            >
                                                {OBLIGATION_TYPES.map((t) => (
                                                    <option key={t} value={t}>
                                                        {t}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">
                                                Periodo
                                            </label>
                                            <input
                                                type="text"
                                                value={newObligation.period}
                                                onChange={(e) =>
                                                    setNewObligation((p) => ({
                                                        ...p,
                                                        period: e.target.value,
                                                        dueDate: defaultDueDate(
                                                            p.type,
                                                            e.target.value,
                                                        ),
                                                    }))
                                                }
                                                placeholder="2026-05"
                                                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">
                                                Fecha venc.
                                            </label>
                                            <input
                                                type="date"
                                                value={newObligation.dueDate}
                                                onChange={(e) =>
                                                    setNewObligation((p) => ({
                                                        ...p,
                                                        dueDate: e.target.value,
                                                    }))
                                                }
                                                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2 py-1.5 text-xs text-white focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">
                                                Descripción
                                            </label>
                                            <input
                                                type="text"
                                                value={newObligation.description}
                                                onChange={(e) =>
                                                    setNewObligation((p) => ({
                                                        ...p,
                                                        description: e.target.value,
                                                    }))
                                                }
                                                placeholder="Opcional"
                                                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAddObligation(company.id)}
                                        disabled={addingObligation}
                                        className="mt-2 text-xs rounded-lg border border-primary/40 text-primary px-3 py-1.5 hover:bg-primary/10 transition-colors"
                                    >
                                        {addingObligation ? 'Guardando...' : '+ Agregar obligación'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
