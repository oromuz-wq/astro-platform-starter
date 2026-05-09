import type { APIRoute } from 'astro';
import { generateAndSaveReport, getLastReport } from '../../../lib/taxStore.js';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
    const refresh = new URL(url).searchParams.get('refresh') === 'true';
    const report = refresh ? await generateAndSaveReport() : ((await getLastReport()) ?? (await generateAndSaveReport()));
    return Response.json(report);
};

export const POST: APIRoute = async () => {
    const report = await generateAndSaveReport();
    return Response.json(report);
};
