import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { getObligations, saveObligations, getFilings, saveFilings } from '../../../lib/taxStore.js';
import type { TaxObligation, TaxObligationType } from '../../../types/tax.js';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
    const companyId = new URL(url).searchParams.get('companyId');
    const obligations = await getObligations();
    const result = companyId ? obligations.filter((o) => o.companyId === companyId) : obligations;
    return Response.json(result);
};

export const POST: APIRoute = async ({ request }) => {
    const body = await request.json();
    if (!body.companyId || !body.type || !body.period || !body.dueDate) {
        return Response.json(
            { error: 'companyId, type, period y dueDate son requeridos' },
            { status: 400 },
        );
    }

    const obligations = await getObligations();

    const duplicate = obligations.find(
        (o) => o.companyId === body.companyId && o.type === body.type && o.period === body.period,
    );
    if (duplicate) {
        return Response.json(
            { error: 'Ya existe una obligación de ese tipo/periodo para esa empresa' },
            { status: 409 },
        );
    }

    const newObligation: TaxObligation = {
        id: randomUUID(),
        companyId: body.companyId,
        type: body.type as TaxObligationType,
        period: body.period,
        dueDate: body.dueDate,
        description: body.description?.trim(),
    };

    obligations.push(newObligation);
    await saveObligations(obligations);

    return Response.json(newObligation, { status: 201 });
};

export const DELETE: APIRoute = async ({ url }) => {
    const id = new URL(url).searchParams.get('id');
    if (!id) return Response.json({ error: 'id es requerido' }, { status: 400 });

    const [obligations, filings] = await Promise.all([getObligations(), getFilings()]);

    await Promise.all([
        saveObligations(obligations.filter((o) => o.id !== id)),
        saveFilings(filings.filter((f) => f.obligationId !== id)),
    ]);

    return new Response(null, { status: 204 });
};
