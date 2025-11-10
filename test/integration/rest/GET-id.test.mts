import { HttpStatus } from '@nestjs/common';
import { describe, expect, test } from 'vitest';
import { CONTENT_TYPE, IF_NONE_MATCH, restURL } from '../constants.mjs';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const ids = [1, 9];
const idNichtVorhanden = 999999;
const idsETag = [1, 9];
const idFalsch = 'xy';

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
describe('GET /rest/:id', () => {
    test.concurrent.each(ids)('Auto zu vorhandener ID %i', async (id) => {
        // given
        const url = `${restURL}/${id}`;

        // when
        const response = await fetch(url);
        const { status, headers } = response;

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

        const body = (await response.json()) as { id: number };

        expect(body.id).toBe(id);
    });

    test.concurrent('Kein Auto zu nicht-vorhandener ID', async () => {
        // given
        const url = `${restURL}/${idNichtVorhanden}`;

        // when
        const { status } = await fetch(url);

        // then
        expect(status).toBe(HttpStatus.NOT_FOUND);
    });

    test.concurrent('Kein Auto zu falscher ID', async () => {
        // given
        const url = `${restURL}/${idFalsch}`;

        // when
        const { status } = await fetch(url);

        // then
        expect(status).toBe(HttpStatus.NOT_FOUND);
    });

    test.concurrent.each(idsETag)(
        'Auto zu ID %i mit If-None-Match',
        async (id) => {
            // given
            const url = `${restURL}/${id}`;
            const headers = new Headers();
            headers.append(IF_NONE_MATCH, '"0"');

            // when
            const response = await fetch(url, { headers });
            const { status } = response;

            // then
            expect(status).toBe(HttpStatus.NOT_MODIFIED);

            const body = await response.text();

            expect(body).toBe('');
        },
    );
});
