import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { getFilings, saveFilings, getObligations } from '../../../lib/taxStore.js';
import type { TaxFiling } from '../../../types/tax.js';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
    const companyId = new URL(url).searchParams.get('companyId');
    const filings = await getFilings();
    const result = companyId ? filings.filter((f) => f.companyId === companyId) : filings;
    return Response.json(result);
};

export const POST: APIRoute = async ({ request }) => {
    const body = await request.json();
    if (!body.obligationId || !body.companyId) {
        return Response.json({ error: 'obligationId y companyId son requeridos' }, { status: 400 });
    }

    const [filings, obligations] = await Promise.all([getFilings(), getObligations()]);

    const obligation = obligations.find((o) => o.id === body.obligationId);
    if (!obligation) {
        return Response.json({ error: 'Obligación no encontrada' }, { status: 404 });
    }

    const existing = filings.find((f) => f.obligationId === body.obligationId);
    if (existing) {
        return Response.json({ error: 'Esta obligación ya fue presentada' }, { status: 409 });
    }

    const newFiling: TaxFiling = {
        id: randomUUID(),
        companyId: body.companyId,
        obligationId: body.obligationId,
        type: obligation.type,
        period: obligation.period,
        filedDate: body.filedDate ?? new Date().toISOString(),
        folio: body.folio?.trim(),
        notes: body.notes?.trim(),
    };

    filings.push(newFiling);
    await saveFilings(filings);

    return Response.json(newFiling, { status: 201 });
};

export const DELETE: APIRoute = async ({ url }) => {
    const id = new URL(url).searchParams.get('id');
    if (!id) return Response.json({ error: 'id es requerido' }, { status: 400 });

    const filings = await getFilings();
    await saveFilings(filings.filter((f) => f.id !== id));

    return new Response(null, { status: 204 });
};
