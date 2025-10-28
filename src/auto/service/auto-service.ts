/**
 * Das Modul besteht aus der Klasse {@linkcode AutoService}.
 * @packageDocumentation
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import {
    Prisma,
    PrismaClient,
} from '../../generated/prisma/client.js';
import { type AutoInclude } from '../../generated/prisma/models/Auto.js';
import { getLogger } from '../../logger/logger.js';
import { type Pageable } from './pageable.js';
import { PrismaService } from './prisma-service.js';
import { type Slice } from './slice.js';
import { type Suchparameter, suchparameterNamen } from './suchparameter.js';
import { WhereBuilder } from './where-builder.js';

// Typdefinition für `findById`
type FindByIdParams = {
    // ID des gesuchten Autos
    readonly id: number;
    /** Sollen die Ausstattungen mitgeladen werden? */
    readonly mitAusstattungen?: boolean;
};

export type AutoMitFahrzeugschein = Prisma.AutoGetPayload<{
    include: { fahrzeugschein: true };
}>;

export type AutoMitFahrzeugscheinUndAusstattungen = Prisma.AutoGetPayload<{
    include: {
        fahrzeugschein: true;
        ausstattungen: true;
    };
}>;

/**
 * Die Klasse `AutoService` implementiert das Lesen für Autos und greift
 * mit _Prisma_ auf eine relationale DB zu.
 */
@Injectable()
export class AutoService {
    static readonly ID_PATTERN = /^[1-9]\d{0,10}$/u;

    readonly #prisma: PrismaClient;
    readonly #whereBuilder: WhereBuilder;
    readonly #includeFahrzeugschein: AutoInclude = { fahrzeugschein: true };
    readonly #includeFahrzeugscheinUndAusstattungen: AutoInclude = {
        fahrzeugschein: true,
        ausstattungen: true,
    };

    readonly #logger = getLogger(AutoService.name);

    constructor(prisma: PrismaService, whereBuilder: WhereBuilder) {
        this.#prisma = prisma.client;
        this.#whereBuilder = whereBuilder;
    }

    /**
     * Ein Auto asynchron anhand seiner ID suchen
     * @param id ID des gesuchten Autos
     * @returns Das gefundene Auto in einem Promise.
     * @throws NotFoundException falls kein Auto mit der ID existiert
     */
    async findById({
        id,
        mitAusstattungen = false,
    }: FindByIdParams): Promise<Readonly<AutoMitFahrzeugscheinUndAusstattungen>> {
        this.#logger.debug('findById: id=%d', id);

        const include = mitAusstattungen
            ? this.#includeFahrzeugscheinUndAusstattungen
            : this.#includeFahrzeugschein;
        const auto: AutoMitFahrzeugscheinUndAusstattungen | null =
            await this.#prisma.auto.findUnique({
                where: { id },
                include,
            });
        if (auto === null) {
            this.#logger.debug('Es gibt kein Auto mit der ID %d', id);
            throw new NotFoundException(`Es gibt kein Auto mit der ID ${id}.`);
        }
        auto.schlagwoerter ??= [];

        this.#logger.debug('findById: auto=%o', auto);
        return auto;
    }

    /**
     * Autos asynchron suchen.
     * @param suchparameter JSON-Objekt mit Suchparameter.
     * @param pageable Maximale Anzahl an Datensätzen und Seitennummer.
     * @returns Ein JSON-Array mit den gefundenen Autos.
     * @throws NotFoundException falls keine Autos gefunden wurden.
     */
    async find(
        suchparameter: Suchparameter | undefined,
        pageable: Pageable,
    ): Promise<Readonly<Slice<Readonly<AutoMitFahrzeugschein>>>> {
        this.#logger.debug(
            'find: suchparameter=%s, pageable=%o',
            JSON.stringify(suchparameter),
            pageable,
        );

        if (suchparameter === undefined) {
            return await this.#findAll(pageable);
        }
        const keys = Object.keys(suchparameter);
        if (keys.length === 0) {
            return await this.#findAll(pageable);
        }

        if (!this.#checkKeys(keys) || !this.#checkEnums(suchparameter)) {
            this.#logger.debug('Ungueltige Suchparameter');
            throw new NotFoundException('Ungueltige Suchparameter');
        }

        const where = this.#whereBuilder.build(suchparameter);
        const { number, size } = pageable;
        const autos: AutoMitFahrzeugschein[] = await this.#prisma.auto.findMany({
            where,
            skip: number * size,
            take: size,
            include: this.#includeFahrzeugschein,
        });
        if (autos.length === 0) {
            this.#logger.debug('find: Keine Autos gefunden');
            throw new NotFoundException(
                `Keine Autos gefunden: ${JSON.stringify(suchparameter)}, Seite ${pageable.number}}`,
            );
        }
        const totalElements = await this.count();
        return this.#createSlice(autos, totalElements);
    }

    /**
     * Eine Datei  zu einem Auto anhand der Auto-ID suchen.
     * @param id ID des Autos, zu dem die Datei gehört.
     * @returns Die gefundene Datei in einem Promise.
     * @throws NotFoundException falls kein Auto oder keine Datei gefunden wurde.
     */
    async findFileByAutoId(id: number) {
        this.#logger.debug('findFileByAutoId: id=%d', id);

        const auto = await this.#prisma.auto.findUnique({
            where: { id },
            select: { id: true },
        });
        if (auto === null) {
            this.#logger.debug('Es gibt kein Auto mit der ID %d', id);
            throw new NotFoundException(`Es gibt kein Auto mit der ID ${id}.`);
        }

        const file = await this.#prisma.autoFile.findUnique({
            where: { autoId: id },
        });
        if (file === null) {
            this.#logger.debug('Keine Datei für Auto mit ID %d gefunden', id);
            throw new NotFoundException(
                `Keine Datei für Auto mit der ID ${id} gefunden.`,
            );
        }

        this.#logger.debug('findFileByAutoId: file=%s', file.filename);
        return file;
    }

    /**
     * Anzahl aller Autos zurückliefern.
     * @returns Die Anzahl aller Autos.
     */
    async count() {
        this.#logger.debug('count');
        const count = await this.#prisma.auto.count();
        this.#logger.debug('count: %d', count);
        return count;
    }

    async #findAll(pageable: Pageable): Promise<Readonly<Slice<AutoMitFahrzeugschein>>> {
        const { number, size } = pageable;
        const autos: AutoMitFahrzeugschein[] = await this.#prisma.auto.findMany({
            skip: number * size,
            take: size,
            include: this.#includeFahrzeugschein,
        });
        if (autos.length === 0) {
            this.#logger.debug('#findAll: Keine Autos gefunden');
            throw new NotFoundException(`Ungueltige Seite "${number}"`);
        }
        const totalElements = await this.count();
        return this.#createSlice(autos, totalElements);
    }

    #createSlice(
        autos: AutoMitFahrzeugschein[],
        totalElements: number,
    ): Readonly<Slice<AutoMitFahrzeugschein>> {
        autos.forEach((auto) => {
            auto.schlagwoerter ??= [];
        });
        const autoSlice: Slice<AutoMitFahrzeugschein> = {
            content: autos,
            totalElements,
        };
        this.#logger.debug('createSlice: autoSlice=%o', autoSlice);
        return autoSlice;
    }

    #checkKeys(keys: string[]) {
        this.#logger.debug('#checkKeys: keys=%o', keys);
        let validKeys = true;
        keys.forEach((key) => {
            if (
                !suchparameterNamen.includes(key) &&
                                key !== 'allrad' &&
                key !== 'benzin' &&
                key !== 'budget' &&
                key !== 'business' &&
                key !== 'cabrio' &&
                key !== 'e_auto' &&
                key !== 'einfach' &&
                key !== 'familie' &&
                key !== 'hybrid' &&
                key !== 'komfort' &&
                key !== 'kombi' &&
                key !== 'nutzfahrzeug' &&
                key !== 'pickup' &&
                key !== 'reichweite' &&
                key !== 'sparsam' &&
                key !== 'sport' &&
                key !== 'suv' &&
                key !== 'tech' &&
                key !== 'vier_x_vier'
            ) {
                this.#logger.debug(
                    '#checkKeys: ungueltiger Suchparameter "%s"',
                    key,
                );
                validKeys = false;
            }
        });

        return validKeys;
    }

    #checkEnums(suchparameter: Suchparameter) {
        const { art } = suchparameter;
        this.#logger.debug(
            '#checkEnums: Suchparameter "art=%s"',
            art ?? 'undefined',
        );
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return (
            art === undefined ||
            art === 'SUV' ||
            art === 'CABRIO' ||
            art === 'LIMOUSINE' ||
            art === 'E_AUTO' ||
            art === 'KOMBI' ||
            art === 'PICKUP' ||
            art === 'CROSSOVER'
    );
    }
}
