/**
 * Das Modul besteht aus der Klasse {@linkcode WhereBuilder}.
 * @packageDocumentation
 */

import { Injectable } from '@nestjs/common';
import { Autoart, Prisma } from '../../generated/prisma/client.js';
import { type AutoWhereInput } from '../../generated/prisma/models/Auto.js';
import { getLogger } from '../../logger/logger.js';
import { type Suchparameter } from './suchparameter.js';

/** Typdefinitionen für die Suche mit der Auto-ID. */
export type BuildIdParams = {
    /** ID des gesuchten Autos. */
    readonly id: number;
    /** Sollen die Ausstattungen mitgeladen werden? */
    readonly mitAusstattungen?: boolean;
};

/**
 * Die Klasse `WhereBuilder` baut die WHERE-Klausel für DB-Anfragen mit _Prisma_.
 */
@Injectable()
export class WhereBuilder {
    readonly #logger = getLogger(WhereBuilder.name);

    /**
     * WHERE-Klausel für die flexible Suche nach Autos bauen.
     * @param suchparameter JSON-Objekt mit Suchparametern. Bei "identifikationsNummer" wird mit
     * einem Teilstring gesucht, bei "rating" mit einem Mindestwert (>=), bei "preis"
     * mit der Obergrenze (<=).
     * @returns AutoWhereInput
     */
    // "rest properties" ab ES 2018 https://github.com/tc39/proposal-object-rest-spread
    // eslint-disable-next-line max-lines-per-function, prettier/prettier, sonarjs/cognitive-complexity
    build({
        // Schlagwort-Flags (true/false als String)
        allrad,
        benzin,
        budget,
        business,
        cabrio,
        e_auto,
        einfach,
        familie,
        hybrid,
        komfort,
        kombi,
        nutzfahrzeug,
        pickup,
        reichweite,
        sparsam,
        sport,
        suv,
        tech,
        vier_x_vier,
        // übrige Parameter
        ...restProps
    }: Suchparameter) {
        this.#logger.debug(
            'build: tags=%o, restProps=%o',
            {
                allrad,
                benzin,
                budget,
                business,
                cabrio,
                e_auto,
                einfach,
                familie,
                hybrid,
                komfort,
                kombi,
                nutzfahrzeug,
                pickup,
                reichweite,
                sparsam,
                sport,
                suv,
                tech,
                vier_x_vier,
            },
            restProps,
        );

        // Beispiel:
        // { identifikationsNummer: 'WDB', rating: 4, preis: 35000, suv: 'true' }
        // WHERE fahrzeugschein.identifikations_nummer ILIKE %WDB%
        //   AND rating >= 4
        //   AND preis <= 35000
        //   AND schlagwoerter @> '["SUV"]'

        const where: AutoWhereInput = {};

        // Properties mit Vergleichen, z.B. Gleichheit, <= (lte), >= (gte)
        Object.entries(restProps).forEach(([key, value]) => {
            switch (key) {
                case 'identifikationsNummer':
                    where.fahrzeugschein = {
                        // https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting#filter-on-relations
                        identifikationsNummer: {
                            // https://www.prisma.io/docs/orm/reference/prisma-client-reference#filter-conditions-and-operators
                            contains: value as string,
                            mode: Prisma.QueryMode.insensitive,
                        },
                    };
                    break;
                case 'fin':
                    where.fin = { equals: value as string };
                    break;
                case 'rating': {
                    const ratingNumber = Number.parseInt(value as string);
                    if (!Number.isNaN(ratingNumber)) {
                        where.rating = { gte: ratingNumber };
                    }
                    break;
                }
                case 'preis': {
                    const preisNumber = Number.parseFloat(value as string);
                    if (!Number.isNaN(preisNumber)) {
                        where.preis = { lte: preisNumber };
                    }
                    break;
                }
                case 'art':
                    // enum
                    where.art = { equals: value as Autoart };
                    break;
                case 'lieferbar':
                    // boolean alias -> verfuegbar
                    where.verfuegbar = {
                        equals: (value as string).toLowerCase() === 'true',
                    };
                    break;
                case 'verfuegbar':
                    where.verfuegbar = {
                        equals: (value as string).toLowerCase() === 'true',
                    };
                    break;
                case 'baujahr':
                case 'datum':
                    // ab einem Datum (inklusive)
                    where.baujahr = { gte: new Date(value as string) };
                    break;
                case 'homepage':
                    where.homepage = { equals: value as string };
                    break;
                default:
                    // unbekannte Keys ignorieren
                    break;
            }
        });

        const schlagwoerter = this.#buildSchlagwoerter({
            allrad,
            benzin,
            budget,
            business,
            cabrio,
            e_auto,
            einfach,
            familie,
            hybrid,
            komfort,
            kombi,
            nutzfahrzeug,
            pickup,
            reichweite,
            sparsam,
            sport,
            suv,
            tech,
            vier_x_vier,
        });

        if (schlagwoerter.length > 0) {
            // https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields#json-object-arrays
            where.schlagwoerter = { array_contains: schlagwoerter };
        }

        this.#logger.debug('build: where=%o', where);
        return where;
    }

    #buildSchlagwoerter({
        allrad,
        benzin,
        budget,
        business,
        cabrio,
        e_auto,
        einfach,
        familie,
        hybrid,
        komfort,
        kombi,
        nutzfahrzeug,
        pickup,
        reichweite,
        sparsam,
        sport,
        suv,
        tech,
        vier_x_vier,
    }: {
        allrad: string | undefined;
        benzin: string | undefined;
        budget: string | undefined;
        business: string | undefined;
        cabrio: string | undefined;
        e_auto: string | undefined;
        einfach: string | undefined;
        familie: string | undefined;
        hybrid: string | undefined;
        komfort: string | undefined;
        kombi: string | undefined;
        nutzfahrzeug: string | undefined;
        pickup: string | undefined;
        reichweite: string | undefined;
        sparsam: string | undefined;
        sport: string | undefined;
        suv: string | undefined;
        tech: string | undefined;
        vier_x_vier: string | undefined; // für "4x4"
    }): ReadonlyArray<string> {
        const schlagwoerter: string[] = [];

        if (allrad?.toLowerCase() === 'true') schlagwoerter.push('ALLRAD');
        if (benzin?.toLowerCase() === 'true') schlagwoerter.push('BENZIN');
        if (budget?.toLowerCase() === 'true') schlagwoerter.push('BUDGET');
        if (business?.toLowerCase() === 'true') schlagwoerter.push('BUSINESS');
        if (cabrio?.toLowerCase() === 'true') schlagwoerter.push('CABRIO');
        if (e_auto?.toLowerCase() === 'true') schlagwoerter.push('E-AUTO');
        if (einfach?.toLowerCase() === 'true') schlagwoerter.push('EINFACH');
        if (familie?.toLowerCase() === 'true') schlagwoerter.push('FAMILIE');
        if (hybrid?.toLowerCase() === 'true') schlagwoerter.push('HYBRID');
        if (komfort?.toLowerCase() === 'true') schlagwoerter.push('KOMFORT');
        if (kombi?.toLowerCase() === 'true') schlagwoerter.push('KOMBI');
        if (nutzfahrzeug?.toLowerCase() === 'true')
            schlagwoerter.push('NUTZFAHRZEUG');
        if (pickup?.toLowerCase() === 'true') schlagwoerter.push('PICKUP');
        if (reichweite?.toLowerCase() === 'true')
            schlagwoerter.push('REICHWEITE');
        if (sparsam?.toLowerCase() === 'true') schlagwoerter.push('SPARSAM');
        if (sport?.toLowerCase() === 'true') schlagwoerter.push('SPORT');
        if (suv?.toLowerCase() === 'true') schlagwoerter.push('SUV');
        if (tech?.toLowerCase() === 'true') schlagwoerter.push('TECH');
        if (vier_x_vier?.toLowerCase() === 'true') schlagwoerter.push('4x4');

        return schlagwoerter;
    }
}
