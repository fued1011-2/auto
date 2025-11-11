import { HttpStatus } from '@nestjs/common';
import BigNumber from 'bignumber.js';
import { beforeAll, describe, expect, test } from 'vitest';
import { type AutoDTO } from '../../../src/auto/controller/auto-dto.js';
import { AutoService } from '../../../src/auto/service/auto-service.js';
import {
    APPLICATION_JSON,
    AUTHORIZATION,
    BEARER,
    CONTENT_TYPE,
    LOCATION,
    POST,
    restURL,
} from '../constants.mjs';
import { getToken } from '../token.mjs';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const neuesAuto: Omit<AutoDTO, 'preis' | 'rabatt' | 'ausstattungen'> & {
    preis: number;
    rabatt: number;
    ausstattungen: {
        bezeichnung: string;
        beschreibung: string;
        preis: number;
    }[];
} = {
    fin: "HUN12345678923451",
    rating: 3,
    art: "SUV",
    preis: 12999.99,
    rabatt: 0.05,
    verfuegbar: true,
    baujahr: "2023-01-20T00:00:00.000Z",
    homepage: "https://www.mercedes.de",
    schlagwoerter: [
        "ALLRAD",
        "HYBRID"
    ],
    fahrzeugschein: {
        identifikationsNummer: "KA-MC3456",
        erstzulassung: "2023-03-15T00:00:00.000Z",
        gueltigBis: "2028-03-15T00:00:00.000Z"
    },
    ausstattungen: [
        {
            bezeichnung: "Navigation",
            beschreibung: "Navigationssystem mit Touchscreen",
            preis: 329.99
        },
        {
            bezeichnung: "Massage-Sitze",
            beschreibung: "Massage-Sitze mit zentralem Touch-Control-Panel, inkl. Sitzheizung",
            preis: 659.99
        }
    ]
};
const neuesAutoInvalid: Record<string, unknown> = {
    fin: 'falsche-FIN',
    rating: -1,
    art: 'PORSCHE',
    preis: -1,
    rabatt: 2,
    verfuegbar: true,
    baujahr: '12345-123-123',
    homepage: 'anyHomepage',
    fahrzeugschein: {
        identifikationsNummer: '?!',
        erstzulassung: '12345-123-123',
        gueltigBis: '12345-123-123'
    },
};
const neuesAutoFinExistiert: AutoDTO = {
    fin: 'HYU12398765412TUC',
    rating: 1,
    art: 'LIMOUSINE',
    preis: new BigNumber(99.99),
    rabatt: new BigNumber(0.09),
    verfuegbar: true,
    baujahr: '2025-02-28T00:00:00Z',
    homepage: 'https://bmw.de/',
    schlagwoerter: ['SPORT', 'REICHWEITE'],
    fahrzeugschein: {
        identifikationsNummer: "M-MC3456",
        erstzulassung: "2023-03-15T00:00:00.000Z",
        gueltigBis: "2028-03-15T00:00:00.000Z"
    },
    ausstattungen: [],
};

type MessageType = { message: string };

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
describe('POST /rest', () => {
    let token: string;

    beforeAll(async () => {
        token = await getToken('admin', 'p');
    });

    test('Neues Auto', async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesAuto),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.CREATED);

        const responseHeaders = response.headers;
        const location = responseHeaders.get(LOCATION);

        expect(location).toBeDefined();

        // ID nach dem letzten "/"
        const indexLastSlash = location?.lastIndexOf('/') ?? -1;

        expect(indexLastSlash).not.toBe(-1);

        const idStr = location?.slice(indexLastSlash + 1);

        expect(idStr).toBeDefined();
        expect(AutoService.ID_PATTERN.test(idStr ?? '')).toBe(true);
    });

    test.concurrent('Neues Auto mit ungueltigen Daten', async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        const expectedMsg = [
            expect.stringMatching(/^FIN /u),
            expect.stringMatching(/^rating /u),
            expect.stringMatching(/^art /u),
            expect.stringMatching(/^preis /u),
            expect.stringMatching(/^rabatt /u),
            expect.stringMatching(/^baujahr /u),
            expect.stringMatching(/^homepage /u),
            expect.stringMatching(/^fahrzeugschein.identifikationsNummer /u),
            expect.stringMatching(/^fahrzeugschein.erstzulassung /u),
            expect.stringMatching(/^fahrzeugschein.gueltigBis /u),
        ];

        // when
        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesAutoInvalid),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.BAD_REQUEST);

        const body = (await response.json()) as MessageType;
        const messages = body.message;

        expect(messages).toBeDefined();
        expect(messages).toHaveLength(expectedMsg.length);
        expect(messages).toStrictEqual(expect.arrayContaining(expectedMsg));
    });

    test.concurrent('Neues Auto, aber die FIN existiert bereits', async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesAutoFinExistiert),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);

        const body = (await response.json()) as MessageType;

        expect(body.message).toStrictEqual(expect.stringContaining('FIN'));
    });

    test.concurrent('Neues Auto, aber ohne Token', async () => {
        // when
        const { status } = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesAuto),
        });

        // then
        expect(status).toBe(HttpStatus.UNAUTHORIZED);
    });

    test.concurrent('Neues Auto, aber mit falschem Token', async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} FALSCHER_TOKEN`);

        // when
        const { status } = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesAuto),
            headers,
        });

        // then
        expect(status).toBe(HttpStatus.UNAUTHORIZED);
    });

    test.concurrent.todo('Abgelaufener Token');
});
