import { HttpStatus } from '@nestjs/common';
import BigNumber from 'bignumber.js';
import { beforeAll, describe, expect, test } from 'vitest';
import { type AutoDtoOhneRef } from '../../../src/auto/controller/auto-dto.js';
import {
    APPLICATION_JSON,
    AUTHORIZATION,
    BEARER,
    CONTENT_TYPE,
    IF_MATCH,
    PUT,
    restURL,
} from '../constants.mjs';
import { getToken } from '../token.mjs';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const geaendertesAuto: Omit<AutoDtoOhneRef, 'preis' | 'rabatt'> & {
    preis: number;
    rabatt: number;
} = {
    fin: 'TES12345678912XPL',
    rating: 2,
    art: 'KOMBI',
    preis: 11999,
    rabatt: 0.035,
    verfuegbar: true,
    baujahr: '2025-03-03T00:00:00Z',
    homepage: 'https://geaendert.put.rest',
    schlagwoerter: ['FAMILIE'],
};
const idVorhanden = '4';

const geaendertesAutoIdNichtVorhanden: Omit<
    AutoDtoOhneRef,
    'preis' | 'rabatt'
> & {
    preis: number;
    rabatt: number;
} = {
    fin: 'APEL5647382912AST',
    rating: 4,
    art: 'KOMBI',
    preis: 44.4,
    rabatt: 0.044,
    verfuegbar: true,
    baujahr: '2025-02-04T00:00:00Z',
    homepage: 'https://acme.de',
    schlagwoerter: ['KOMFORT'],
};
const idNichtVorhanden = '999999';

const geaendertesAutoInvalid: Record<string, unknown> = {
    fin: 'falsche-FIN',
    rating: -1,
    art: 'FALSCH',
    preis: -1,
    rabatt: 2,
    verfuegbar: true,
    baujahr: '12345-123-123',
    homepage: 'anyHomepage',
};

const veraltesAuto: AutoDtoOhneRef = {
    fin: 'FARD8374651922MST',
    rating: 1,
    art: 'KOMBI',
    preis: new BigNumber(44.4),
    rabatt: new BigNumber(0.04),
    verfuegbar: true,
    baujahr: '2025-02-04T00:00:00Z',
    homepage: 'https://ford.de',
    schlagwoerter: ['SPORT'],
};

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
describe('PUT /rest/:id', () => {
    let token: string;

    beforeAll(async () => {
        token = await getToken('admin', 'p');
    });

    test('Vorhandenes Auto aendern', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"');
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const { status } = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertesAuto),
            headers,
        });

        // then
        expect(status).toBe(HttpStatus.NO_CONTENT);
    });

    test('Nicht-vorhandenes Auto aendern', async () => {
        // given
        const url = `${restURL}/${idNichtVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"');
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const { status } = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertesAutoIdNichtVorhanden),
            headers,
        });

        // then
        expect(status).toBe(HttpStatus.NOT_FOUND);
    });

    test('Vorhandenes Auto aendern, aber mit ungueltigen Daten', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"');
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);
        const expectedMsg = [
            expect.stringMatching(/^FIN /u),
            expect.stringMatching(/^rating /u),
            expect.stringMatching(/^art /u),
            expect.stringMatching(/^preis /u),
            expect.stringMatching(/^rabatt /u),
            expect.stringMatching(/^baujahr /u),
            expect.stringMatching(/^homepage /u),
        ];

        // when
        const response = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertesAutoInvalid),
            headers,
        });

        // then
        expect(response.status).toBe(HttpStatus.BAD_REQUEST);

        const body = (await response.json()) as { message: string[] };
        const messages = body.message;

        expect(messages).toBeDefined();
        expect(messages).toHaveLength(expectedMsg.length);
        expect(messages).toStrictEqual(expect.arrayContaining(expectedMsg));
    });

    test('Vorhandenes Auto aendern, aber ohne Versionsnummer', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertesAuto),
            headers,
        });

        // then
        expect(response.status).toBe(HttpStatus.PRECONDITION_REQUIRED);

        const body = await response.text();

        expect(body).toBe(`Header "${IF_MATCH}" fehlt`);
    });

    test('Vorhandenes Auto aendern, aber mit alter Versionsnummer', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"-1"');
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(url, {
            method: PUT,
            body: JSON.stringify(veraltesAuto),
            headers,
        });

        // then
        expect(response.status).toBe(HttpStatus.PRECONDITION_FAILED);

        const { message, statusCode } = (await response.json()) as {
            message: string;
            statusCode: number;
        };

        expect(message).toMatch(/Versionsnummer/u);
        expect(statusCode).toBe(HttpStatus.PRECONDITION_FAILED);
    });

    test('Vorhandenes Auto aendern, aber ohne Token', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"');

        // when
        const { status } = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertesAuto),
            headers,
        });

        // then
        expect(status).toBe(HttpStatus.UNAUTHORIZED);
    });

    test('Vorhandenes Auto aendern, aber mit falschem Token', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"');
        headers.append(AUTHORIZATION, `${BEARER} FALSCHER_TOKEN`);

        // when
        const { status } = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertesAuto),
            headers,
        });

        // then
        expect(status).toBe(HttpStatus.UNAUTHORIZED);
    });
});
