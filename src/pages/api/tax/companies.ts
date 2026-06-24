import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { getCompanies, saveCompanies } from '../../../lib/taxStore.js';
import type { Company } from '../../../types/tax.js';

export const prerender = false;

export const GET: APIRoute = async () => {
    const companies = await getCompanies();
    return Response.json(companies);
};

export const POST: APIRoute = async ({ request }) => {
    const body = await request.json();
    if (!body.name || !body.rut) {
        return Response.json({ error: 'name y rut son requeridos' }, { status: 400 });
    }

    const companies = await getCompanies();

    const existing = companies.find((c) => c.rut === body.rut);
    if (existing) {
        return Response.json({ error: 'Ya existe una empresa con ese RUT' }, { status: 409 });
    }

    const newCompany: Company = {
        id: randomUUID(),
        name: body.name.trim(),
        rut: body.rut.trim(),
        email: body.email?.trim(),
        active: true,
        createdAt: new Date().toISOString(),
    };

    companies.push(newCompany);
    await saveCompanies(companies);

    return Response.json(newCompany, { status: 201 });
};

export const PATCH: APIRoute = async ({ request }) => {
    const body = await request.json();
    if (!body.id) {
        return Response.json({ error: 'id es requerido' }, { status: 400 });
    }

    const companies = await getCompanies();
    const idx = companies.findIndex((c) => c.id === body.id);
    if (idx === -1) {
        return Response.json({ error: 'Empresa no encontrada' }, { status: 404 });
    }

    companies[idx] = { ...companies[idx], ...body };
    await saveCompanies(companies);

    return Response.json(companies[idx]);
};

export const DELETE: APIRoute = async ({ url }) => {
    const id = new URL(url).searchParams.get('id');
    if (!id) return Response.json({ error: 'id es requerido' }, { status: 400 });

    const companies = await getCompanies();
    const filtered = companies.filter((c) => c.id !== id);
    await saveCompanies(filtered);

    return new Response(null, { status: 204 });
};
