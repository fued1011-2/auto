import { HttpStatus } from '@nestjs/common';
import BigNumber from 'bignumber.js';
import { describe, expect, test } from 'vitest';
import { type Page } from '../../../src/auto/controller/page.js';
import { CONTENT_TYPE, restURL } from '../constants.mjs';
import { Auto } from '../../../src/generated/prisma/client.js';
import { AutoMitFahrzeugschein } from '../../../src/auto/service/auto-service.js';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const identifikationsNummerArray = ['ka', 's', 'm'];
const identifikationsNummerNichtVorhanden = ['c', 'g', 'i'];
const fins = ['WDB12345678912XYZ', 'WAU98765432112ABC', 'BMW19283746512FWE'];
const ratingMin = [3, 4];
const preisMax = [40000, 50000];
const schlagwoerter = ['familie', 'sport'];
const schlagwoerterNichtVorhanden = ['WASSER', 'FEUER'];

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
describe('GET /rest', () => {
    test.concurrent('Alle Autos', async () => {
        // when
        const response = await fetch(restURL);
        const { status, headers } = response;

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

        const body = (await response.json()) as Page<Auto>;

        body.content
            .map((auto) => auto.id)
            .forEach((id) => {
                expect(id).toBeDefined();
            });
    });

    test.concurrent.each(identifikationsNummerArray)(
        'Autos mit Teil-Identifikationsnummer %s suchen',
        async (identifikationsNummer) => {
            // given
            const params = new URLSearchParams({ identifikationsNummer });
            const url = `${restURL}?${params}`;

            // when
            const response = await fetch(url);
            const { status, headers } = response;

            // then
            expect(status).toBe(HttpStatus.OK);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body = (await response.json()) as Page<AutoMitFahrzeugschein>;

            expect(body).toBeDefined();

            // Jedes Auto hat eine Identifikationsnummer mit dem Teilstring
            body.content
                .map((auto) => auto.fahrzeugschein)
                .forEach((f) =>
                    expect(
                        f?.identifikationsNummer?.toLowerCase(),
                    ).toStrictEqual(
                        expect.stringContaining(identifikationsNummer),
                    ),
                );
        },
    );

    test.concurrent.each(identifikationsNummerNichtVorhanden)(
        'Autos zu nicht vorhandener Teil-Identifikationsnummer %s suchen',
        async (identifikationsNummer) => {
            // given
            const params = new URLSearchParams({ identifikationsNummer });
            const url = `${restURL}?${params}`;

            // when
            const { status } = await fetch(url);

            // then
            expect(status).toBe(HttpStatus.NOT_FOUND);
        },
    );

    test.concurrent.each(fins)('Auto mit FIN %s suchen', async (fin) => {
        // given
        const params = new URLSearchParams({ fin });
        const url = `${restURL}?${params}`;

        // when
        const response = await fetch(url);
        const { status, headers } = response;

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

        const body = (await response.json()) as Page<Auto>;

        expect(body).toBeDefined();

        // 1 Auto mit der FIN
        const autos = body.content;

        expect(autos).toHaveLength(1);

        const [auto] = autos;
        const finFound = auto?.fin;

        expect(finFound).toBe(fin);
    });

    test.concurrent.each(ratingMin)(
        'Autos mit Mindest-"rating" %i suchen',
        async (rating) => {
            // given
            const params = new URLSearchParams({ rating: rating.toString() });
            const url = `${restURL}?${params}`;

            // when
            const response = await fetch(url);
            const { status, headers } = response;

            // then
            expect(status).toBe(HttpStatus.OK);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body = (await response.json()) as Page<Auto>;

            // Jedes Auto hat eine Bewertung >= rating
            body.content
                .map((auto) => auto.rating)
                .forEach((r) => expect(r).toBeGreaterThanOrEqual(rating));
        },
    );

    test.concurrent.each(preisMax)(
        'Autos mit max. Preis %d suchen',
        async (preis) => {
            // given
            const params = new URLSearchParams({ preis: preis.toString() });
            const url = `${restURL}?${params}`;

            // when
            const response = await fetch(url);
            const { status, headers } = response;

            // then
            expect(status).toBe(HttpStatus.OK);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body = (await response.json()) as Page<Auto>;

            // Jedes Auto hat einen Preis <= preis
            body.content
                .map((auto) => BigNumber(auto?.preis?.toString() ?? 0))
                .forEach((p) =>
                    expect(p.isLessThanOrEqualTo(BigNumber(preis))).toBe(true),
                );
        },
    );

    test.concurrent.each(schlagwoerter)(
        'Mind. 1 Auto mit Schlagwort %s',
        async (schlagwort) => {
            // given
            const params = new URLSearchParams({ [schlagwort]: 'true' });
            const url = `${restURL}?${params}`;

            // when
            const response = await fetch(url);
            const { status, headers } = response;

            // then
            expect(status).toBe(HttpStatus.OK);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body = (await response.json()) as Page<Auto>;

            // JSON-Array mit mind. 1 JSON-Objekt
            expect(body).toBeDefined();

            // Jedes Auto hat im Array der Schlagwoerter z.B. "javascript"
            body.content
                .map((auto) => auto.schlagwoerter)
                .forEach((schlagwoerter) =>
                    expect(schlagwoerter).toStrictEqual(
                        expect.arrayContaining([schlagwort.toUpperCase()]),
                    ),
                );
        },
    );

    test.concurrent.each(schlagwoerterNichtVorhanden)(
        'Keine Autos zu einem nicht vorhandenen Schlagwort',
        async (schlagwort) => {
            const params = new URLSearchParams({ [schlagwort]: 'true' });
            const url = `${restURL}?${params}`;

            // when
            const { status } = await fetch(url);

            // then
            expect(status).toBe(HttpStatus.NOT_FOUND);
        },
    );

    test.concurrent(
        'Keine Autos zu einer nicht-vorhandenen Property',
        async () => {
            // given
            const params = new URLSearchParams({ foo: 'bar' });
            const url = `${restURL}?${params}`;

            // when
            const { status } = await fetch(url);

            // then
            expect(status).toBe(HttpStatus.NOT_FOUND);
        },
    );
});
