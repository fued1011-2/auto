/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { type GraphQLRequest } from '@apollo/server';
import { HttpStatus } from '@nestjs/common';
import { beforeAll, describe, expect, test } from 'vitest';
import {
    ACCEPT,
    APPLICATION_JSON,
    CONTENT_TYPE,
    GRAPHQL_RESPONSE_JSON,
    POST,
    graphqlURL,
} from '../constants.mjs';
import { Autoart, type Prisma } from '../../../src/generated/prisma/client.js';

export type AutoDTO = Omit<
    Prisma.AutoGetPayload<{
        include: {
            fahrzeugschein: true;
        };
    }>,
    'aktualisiert' | 'erzeugt' | 'rabatt'
>;

type AutoSuccessType = { data: { auto: AutoDTO }; errors?: undefined };
type AutosSuccessType = { data: { autos: AutoDTO[] }; errors?: undefined };

export type ErrorsType = {
    message: string;
    path: string[];
    extensions: { code: string };
}[];
type AutoErrorsType = { data: { auto: null }; errors: ErrorsType };
type AutosErrorsType = { data: { autos: null }; errors: ErrorsType };

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const ids = [1, 2];

const identifikationsNummerArray = ['ka', 's', 'm'];
const identifikationsNummerNichtVorhanden = ['c', 'g', 'i'];
const fins = ['WDB12345678912XYZ', 'WAU98765432112ABC', 'BMW19283746512FWE'];
const ratingMin = [3, 4];
const ratingNichtVorhanden = 99;

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
describe('GraphQL Queries', () => {
    let headers: Headers;

    beforeAll(() => {
        headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(ACCEPT, GRAPHQL_RESPONSE_JSON);
    });

    test.concurrent.each(ids)('Auto zu ID %i', async (id) => {
        // given
        const query: GraphQLRequest = {
            query: `
                {
                    auto(id: "${id}") {
                        version
                        fin
                        rating
                        art
                        preis
                        verfuegbar
                        baujahr
                        homepage
                        schlagwoerter
                        fahrzeugschein {
                            identifikationsNummer
                        }
                        rabatt(short: true)
                    }
                }
            `,
        };

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(query),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(response.headers.get(CONTENT_TYPE)).toMatch(
            /application\/graphql-response\+json/iu,
        );

        const { data, errors } = (await response.json()) as AutoSuccessType;

        expect(errors).toBeUndefined();
        expect(data).toBeDefined();

        const { auto } = data;

        expect(auto.fahrzeugschein?.identifikationsNummer).toMatch(/^[A-ZÄÖÜ]{1,3}-[A-Z]{1,3}\d{1,4}$/);
        expect(auto.version).toBeGreaterThan(-1);
        expect(auto.id).toBeUndefined();
    });

    test.concurrent('Auto zu nicht-vorhandener ID', async () => {
        // given
        const id = '999999';
        const query: GraphQLRequest = {
            query: `
                {
                    auto(id: "${id}") {
                        fahrzeugschein {
                            identifikationsNummer
                        }
                    }
                }
            `,
        };

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(query),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(response.headers.get(CONTENT_TYPE)).toMatch(
            /application\/graphql-response\+json/iu,
        );

        const { data, errors } = (await response.json()) as AutoErrorsType;

        expect(data.auto).toBeNull();
        expect(errors).toHaveLength(1);

        const [error] = errors;
        const { message, path, extensions } = error!;

        expect(message).toBe(`Es gibt kein Auto mit der ID ${id}.`);
        expect(path).toBeDefined();
        expect(path![0]).toBe('auto');
        expect(extensions).toBeDefined();
        expect(extensions!.code).toBe('BAD_USER_INPUT');
    });

    test.concurrent.each(identifikationsNummerArray)(
        'Autos zu Teil-Identifikationsnummer %s',
        async (identifikationsNummer) => {
            // given
            const query: GraphQLRequest = {
                query: `
                    {
                        autos(suchparameter: {
                            identifikationsNummer: "${identifikationsNummer}"
                        }) {
                            fahrzeugschein {
                                identifikationsNummer
                            }
                        }
                    }
                `,
            };

            // when
            const response = await fetch(graphqlURL, {
                method: POST,
                body: JSON.stringify(query),
                headers,
            });

            // then
            const { status } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(response.headers.get(CONTENT_TYPE)).toMatch(
                /application\/graphql-response\+json/iu,
            );

            const { data, errors } =
                (await response.json()) as AutosSuccessType;

            expect(errors).toBeUndefined();
            expect(data).toBeDefined();

            const { autos } = data;

            expect(autos).not.toHaveLength(0);

            autos
                .map((auto) => auto.fahrzeugschein)
                .forEach((f) =>
                    expect(f?.identifikationsNummer?.toLowerCase()).toStrictEqual(
                        expect.stringContaining(identifikationsNummer),
                    ),
                );
        },
    );

    test.concurrent.each(identifikationsNummerNichtVorhanden)(
        'Auto zu nicht vorhandenem Titel %s',
        async (identifikationsNummer) => {
            // given
            const query: GraphQLRequest = {
                query: `
                    {
                        autos(suchparameter: {
                            identifikationsNummer: "${identifikationsNummer}"
                        }) {
                            art
                            fahrzeugschein {
                                identifikationsNummer
                            }
                        }
                    }
                `,
            };

            // when
            const response = await fetch(graphqlURL, {
                method: POST,
                body: JSON.stringify(query),
                headers,
            });

            // then
            const { status } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(response.headers.get(CONTENT_TYPE)).toMatch(
                /application\/graphql-response\+json/iu,
            );

            const { data, errors } =
                (await response.json()) as AutosErrorsType;

            expect(data.autos).toBeNull();
            expect(errors).toHaveLength(1);

            const [error] = errors;
            const { message, path, extensions } = error!;

            expect(message).toMatch(/^Keine Autos gefunden:/u);
            expect(path).toBeDefined();
            expect(path![0]).toBe('autos');
            expect(extensions).toBeDefined();
            expect(extensions!.code).toBe('BAD_USER_INPUT');
        },
    );

    test.concurrent.each(fins)(
        'Auto zu FIN %s',
        async (finExpected) => {
            // given
            const query: GraphQLRequest = {
                query: `
                    {
                        autos(suchparameter: {
                            fin: "${finExpected}"
                        }) {
                            fin
                            fahrzeugschein {
                                identifikationsNummer
                            }
                        }
                    }
                `,
            };

            // when
            const response = await fetch(graphqlURL, {
                method: POST,
                body: JSON.stringify(query),
                headers,
            });

            // then
            const { status } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(response.headers.get(CONTENT_TYPE)).toMatch(
                /application\/graphql-response\+json/iu,
            );

            const { data, errors } =
                (await response.json()) as AutosSuccessType;

            expect(errors).toBeUndefined();
            expect(data).toBeDefined();

            const { autos } = data;

            expect(autos).not.toHaveLength(0);
            expect(autos).toHaveLength(1);

            const [auto] = autos;
            const { fahrzeugschein, fin } = auto!;

            expect(fin).toBe(finExpected);
            expect(fahrzeugschein?.identifikationsNummer).toBeDefined();
        },
    );

    test.concurrent.each(ratingMin)(
        'Autos mit Mindest-"rating" %i',
        async (ratingExpected) => {
            // given
            const teilIdentifikationsNummer = 'a';
            const query: GraphQLRequest = {
                query: `
                    {
                        autos(suchparameter: {
                            rating: ${ratingExpected},
                            identifikationsNummer: "${teilIdentifikationsNummer}"
                        }) {
                            rating
                            fahrzeugschein {
                                identifikationsNummer
                            }
                        }
                    }
                `,
            };

            // when
            const response = await fetch(graphqlURL, {
                method: POST,
                body: JSON.stringify(query),
                headers,
            });

            // then
            const { status } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(response.headers.get(CONTENT_TYPE)).toMatch(
                /application\/graphql-response\+json/iu,
            );

            const { data, errors } =
                (await response.json()) as AutosSuccessType;

            expect(errors).toBeUndefined();
            expect(data).toBeDefined();

            const { autos } = data;

            expect(autos).not.toHaveLength(0);

            autos.forEach((auto) => {
                const { rating, fahrzeugschein } = auto;

                expect(rating).toBeGreaterThanOrEqual(ratingExpected);
                expect(fahrzeugschein?.identifikationsNummer?.toLowerCase()).toStrictEqual(
                    expect.stringContaining(teilIdentifikationsNummer),
                );
            });
        },
    );

    test.concurrent('Kein Auto zu nicht-vorhandenem "rating"', async () => {
        // given
        const query: GraphQLRequest = {
            query: `
                {
                    autos(suchparameter: {
                        rating: ${ratingNichtVorhanden}
                    }) {
                        fahrzeugschein {
                            identifikationsNummer
                        }
                    }
                }
            `,
        };

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(query),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(response.headers.get(CONTENT_TYPE)).toMatch(
            /application\/graphql-response\+json/iu,
        );

        const { data, errors } = (await response.json()) as AutosErrorsType;

        expect(data.autos).toBeNull();
        expect(errors).toHaveLength(1);

        const [error] = errors;
        const { message, path, extensions } = error!;

        expect(message).toMatch(/^Keine Autos gefunden:/u);
        expect(path).toBeDefined();
        expect(path![0]).toBe('autos');
        expect(extensions).toBeDefined();
        expect(extensions!.code).toBe('BAD_USER_INPUT');
    });

    test.concurrent('Autos zur Art "SUV"', async () => {
        // given
        const autoArt: Autoart = 'SUV';
        const query: GraphQLRequest = {
            query: `
                {
                    autos(suchparameter: {
                        art: ${autoArt}
                    }) {
                        art
                        fahrzeugschein {
                            identifikationsNummer
                        }
                    }
                }
            `,
        };

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(query),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(response.headers.get(CONTENT_TYPE)).toMatch(
            /application\/graphql-response\+json/iu,
        );

        const { data, errors } = (await response.json()) as AutosSuccessType;

        expect(errors).toBeUndefined();
        expect(data).toBeDefined();

        const { autos }: { autos: AutoDTO[] } = data;

        expect(autos).not.toHaveLength(0);

        autos.forEach((auto) => {
            const { art, fahrzeugschein } = auto;

            expect(art).toBe(autoArt);
            expect(fahrzeugschein?.identifikationsNummer).toBeDefined();
        });
    });

    test.concurrent('Autos zur einer ungueltigen Art', async () => {
        // given
        const autoArt = 'UNGUELTIG';
        const query: GraphQLRequest = {
            query: `
                {
                    autos(suchparameter: {
                        art: ${autoArt}
                    }) {
                        fahrzeugschein {
                            identifikationsNummer
                        }
                    }
                }
            `,
        };

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(query),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.headers.get(CONTENT_TYPE)).toMatch(
            /application\/graphql-response\+json/iu,
        );

        const { data, errors } = (await response.json()) as AutosErrorsType;

        expect(data).toBeUndefined();
        expect(errors).toHaveLength(1);

        const [error] = errors;
        const { extensions } = error!;

        expect(extensions).toBeDefined();
        expect(extensions!.code).toBe('GRAPHQL_VALIDATION_FAILED');
    });

    test.concurrent('Autos mit verfuegbar=true', async () => {
        // given
        const query: GraphQLRequest = {
            query: `
                {
                    autos(suchparameter: {
                        verfuegbar: true
                    }) {
                        verfuegbar
                        fahrzeugschein {
                            identifikationsNummer
                        }
                    }
                }
            `,
        };

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(query),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(response.headers.get(CONTENT_TYPE)).toMatch(
            /application\/graphql-response\+json/iu,
        );

        const { data, errors } = (await response.json()) as AutosSuccessType;

        expect(errors).toBeUndefined();
        expect(data).toBeDefined();

        const { autos }: { autos: AutoDTO[] } = data;

        expect(autos).not.toHaveLength(0);

        autos.forEach((auto) => {
            const { verfuegbar, fahrzeugschein } = auto;

            expect(verfuegbar).toBe(true);
            expect(fahrzeugschein?.identifikationsNummer).toBeDefined();
        });
    });
});
