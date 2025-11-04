/**
 * Das Modul besteht aus der Klasse {@linkcode AutoWriteService} für die
 * Schreiboperationen im Anwendungskern.
 * @packageDocumentation
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import {
    AutoFile,
    type Prisma,
    PrismaClient,
} from '../../generated/prisma/client.js';
import { getLogger } from '../../logger/logger.js';
import { AutoService } from './auto-service.js';
import {
    FinExistsException,
    VersionInvalidException,
    VersionOutdatedException,
} from './exceptions.js';
import { PrismaService } from './prisma-service.js';

export type AutoCreate = Prisma.AutoCreateInput;
type AutoCreated = Prisma.AutoGetPayload<{
    include: {
        fahrzeugschein: true;
        ausstattungen: true;
    };
}>;

export type AutoUpdate = Prisma.AutoUpdateInput;
/** Typdefinitionen zum Aktualisieren eines Autos mit `update`. */
export type UpdateParams = {
    /** ID des zu aktualisierenden Autos. */
    readonly id: number | undefined;
    /** Auto-Objekt mit den aktualisierten Werten. */
    readonly auto: AutoUpdate;
    /** Versionsnummer für die zu aktualisierenden Werte. */
    readonly version: string;
};
type AutoUpdated = Prisma.AutoGetPayload<{}>;

type AutoFileCreate = Prisma.AutoFileUncheckedCreateInput;
export type AutoFileCreated = Prisma.AutoFileGetPayload<{}>;

/**
 * Die Klasse `AutoWriteService` implementiert den Anwendungskern für das
 * Schreiben von Autos und greift mit _Prisma_ auf die DB zu.
 */
@Injectable()
export class AutoWriteService {
    private static readonly VERSION_PATTERN = /^"\d{1,3}"/u;

    readonly #prisma: PrismaClient;

    readonly #readService: AutoService;

    readonly #logger = getLogger(AutoWriteService.name);

    // eslint-disable-next-line max-params
    constructor(
        prisma: PrismaService,
        readService: AutoService,
    ) {
        this.#prisma = prisma.client;
        this.#readService = readService;
    }

    /**
     * Ein neues Auto soll angelegt werden.
     * @param auto Das neu anzulegende Auto
     * @returns Die ID des neu angelegten Autos
     * @throws FinExists falls die FIN bereits existiert
     */
    async create(auto: AutoCreate) {
        this.#logger.debug('create: auto=%o', auto);
        await this.#validateCreate(auto);

        this.#logger.debug('Validate done')

        // Neuer Datensatz mit generierter ID
        let autoDb: AutoCreated | undefined;
        await this.#prisma.$transaction(async (tx) => {
            this.#logger.debug('Started tx')
            autoDb = await tx.auto.create({
                data: auto,
                include: { fahrzeugschein: true, ausstattungen: true },
            });
            this.#logger.debug('Finished tx')
        });

        this.#logger.debug('create: autoDb.id=%s', autoDb?.id ?? 'N/A');
        return autoDb?.id ?? Number.NaN;
    }

    /**
     * Zu einem vorhandenen Auto eine Binärdatei mit z.B. einem Bild abspeichern.
     * @param autoId ID des vorhandenen Autos
     * @param data Bytes der Datei als Buffer Node
     * @param filename Dateiname
     * @param size Dateigröße in Bytes
     * @returns Entity-Objekt für `AutoFile`
     */
    // eslint-disable-next-line max-params
    async addFile(
        autoId: number,
        data: Uint8Array<ArrayBufferLike>,
        filename: string,
        size: number,
    ): Promise<Readonly<AutoFile> | undefined> {
        this.#logger.debug(
            'addFile: autoId=%d, filename=%s, size=%d',
            autoId,
            filename,
            size,
        );

        let autoFileCreated: AutoFileCreated | undefined;
        await this.#prisma.$transaction(async (tx) => {
            // Auto ermitteln, falls vorhanden
            const auto = tx.auto.findUnique({
                where: { id: autoId },
            });
            if (auto === null) {
                this.#logger.debug('Es gibt kein Auto mit der ID %d', autoId);
                throw new NotFoundException(
                    `Es gibt kein Auto mit der ID ${autoId}.`,
                );
            }

            // evtl. vorhandene Datei löschen
            await tx.autoFile.deleteMany({ where: { autoId } });

            const fileType = await fileTypeFromBuffer(data);
            const mimetype = fileType?.mime ?? null;
            this.#logger.debug('addFile: mimetype=%s', mimetype ?? 'undefined');

            const safeData = new Uint8Array(data.buffer.slice(0)) as Uint8Array<ArrayBuffer>;

            const autoFile: AutoFileCreate = {
                filename,
                data: safeData,
                mimetype,
                autoId,
            };
            autoFileCreated = await tx.autoFile.create({ data: autoFile });
        });

        this.#logger.debug(
            'addFile: id=%d, byteLength=%d, filename=%s, mimetype=%s',
            autoFileCreated?.id ?? Number.NaN,
            autoFileCreated?.data.byteLength ?? Number.NaN,
            autoFileCreated?.filename ?? 'undefined',
            autoFileCreated?.mimetype ?? 'null',
        );
        return autoFileCreated;
    }

    /**
     * Ein vorhandenes Auto soll aktualisiert werden. "Destructured" Argument
     * mit id (ID des zu aktualisierenden Autos), auto (zu aktualisierendes Auto)
     * und version (Versionsnummer für optimistische Synchronisation).
     * @returns Die neue Versionsnummer gemäß optimistischer Synchronisation
     * @throws NotFoundException falls kein Auto zur ID vorhanden ist
     * @throws VersionInvalidException falls die Versionsnummer ungültig ist
     * @throws VersionOutdatedException falls die Versionsnummer veraltet ist
     */
    async update({ id, auto, version }: UpdateParams) {
        this.#logger.debug(
            'update: id=%d, auto=%o, version=%s',
            id ?? Number.NaN,
            auto,
            version,
        );
        if (id === undefined) {
            this.#logger.debug('update: Keine gueltige ID');
            throw new NotFoundException(`Es gibt kein Auto mit der ID ${id}.`);
        }

        await this.#validateUpdate(id, version);

        auto.version = { increment: 1 };
        let autoUpdated: AutoUpdated | undefined;
        await this.#prisma.$transaction(async (tx) => {
            autoUpdated = await tx.auto.update({
                data: auto,
                where: { id },
            });
        });
        this.#logger.debug(
            'update: autoUpdated=%s',
            JSON.stringify(autoUpdated),
        );

        return autoUpdated?.version ?? Number.NaN;
    }

    /**
     * Ein Auto wird asynchron anhand seiner ID gelöscht.
     *
     * @param id ID des zu löschenden Autos
     * @returns true, falls das Auto vorhanden war und gelöscht wurde. Sonst false.
     */
    async delete(id: number) {
        this.#logger.debug('delete: id=%d', id);

        const auto = await this.#prisma.auto.findUnique({
            where: { id },
        });
        if (auto === null) {
            this.#logger.debug('delete: not found');
            return false;
        }

        await this.#prisma.$transaction(async (tx) => {
            await tx.auto.delete({ where: { id } });
        });

        this.#logger.debug('delete');
        return true;
    }

    async #validateCreate({
        fin,
    }: Prisma.AutoCreateInput): Promise<undefined> {
        this.#logger.debug('#validateCreate: fin=%s', fin ?? 'undefined');
        if (fin === undefined) {
            this.#logger.debug('#validateCreate: ok');
            return;
        }

        const anzahl = await this.#prisma.auto.count({ where: { fin } });
        if (anzahl > 0) {
            this.#logger.debug('#validateCreate: fin existiert: %s', fin);
            throw new FinExistsException(fin);
        }
        this.#logger.debug('#validateCreate: ok');
    }

    async #validateUpdate(id: number, versionStr: string) {
        this.#logger.debug(
            '#validateUpdate: id=%d, versionStr=%s',
            id,
            versionStr,
        );
        if (!AutoWriteService.VERSION_PATTERN.test(versionStr)) {
            throw new VersionInvalidException(versionStr);
        }

        const version = Number.parseInt(versionStr.slice(1, -1), 10);
        const autoDb = await this.#readService.findById({ id });

        if (version < autoDb.version) {
            this.#logger.debug('#validateUpdate: versionDb=%d', version);
            throw new VersionOutdatedException(version);
        }
    }
}
