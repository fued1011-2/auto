/**
 * Das Modul besteht aus der Controller-Klasse für Lesen an der REST-Schnittstelle.
 * @packageDocumentation
 */

// eslint-disable-next-line max-classes-per-file
import {
    Controller,
    Get,
    Headers,
    HttpStatus,
    NotFoundException,
    Param,
    ParseIntPipe,
    Query,
    Req,
    Res,
    StreamableFile,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiHeader,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiProperty,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { Public } from 'nest-keycloak-connect';
import { paths } from '../../config/paths.js';
import { Autoart } from '../../generated/prisma/enums.js';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import {
    type AutoMitFahrzeugschein,
    AutoMitFahrzeugscheinUndAusstattungen,
    AutoService,
} from '../service/auto-service.js';
import { createPageable } from '../service/pageable.js';
import { type Suchparameter } from '../service/suchparameter.js';
import { createPage, Page } from './page.js';

/**
 * Klasse für `AutoGetController`, um Queries in _OpenAPI_ bzw. Swagger zu
 * formulieren.
 */
export class AutoQuery implements Suchparameter {
    @ApiProperty({ required: false })
    declare readonly fin?: string;

    @ApiProperty({ required: false })
    declare readonly rating?: number | string;

    @ApiProperty({ required: false })
    declare readonly art?: Autoart;

    @ApiProperty({ required: false })
    declare readonly preis?: number;

    @ApiProperty({ required: false })
    declare readonly rabatt?: number;

    @ApiProperty({ required: false })
    declare readonly verfuegbar?: boolean;

    @ApiProperty({ required: false })
    declare readonly baujahr?: string;

    @ApiProperty({ required: false })
    declare readonly homepage?: string;

    @ApiProperty({ required: false })
    declare readonly allrad?: string;

    @ApiProperty({ required: false })
    declare readonly benzin?: string;

    @ApiProperty({ required: false })
    declare readonly budget?: string;

    @ApiProperty({ required: false })
    declare readonly business?: string;

    @ApiProperty({ required: false })
    declare readonly cabrio?: string;

    @ApiProperty({ required: false })
    declare readonly e_auto?: string;

    @ApiProperty({ required: false })
    declare readonly einfach?: string;

    @ApiProperty({ required: false })
    declare readonly familie?: string;

    @ApiProperty({ required: false })
    declare readonly hybrid?: string;

    @ApiProperty({ required: false })
    declare readonly komfort?: string;

    @ApiProperty({ required: false })
    declare readonly kombi?: string;

    @ApiProperty({ required: false })
    declare readonly nutzfahrzeug?: string;

    @ApiProperty({ required: false })
    declare readonly pickup?: string;

    @ApiProperty({ required: false })
    declare readonly reichweite?: string;

    @ApiProperty({ required: false })
    declare readonly sparsam?: string;

    @ApiProperty({ required: false })
    declare readonly sport?: string;

    @ApiProperty({ required: false })
    declare readonly suv?: string;

    @ApiProperty({ required: false })
    declare readonly tech?: string;

    @ApiProperty({ required: false })
    declare readonly vier_x_vier?: string;

    @ApiProperty({ required: false })
    declare readonly identifikationsNummer?: string;

    @ApiProperty({ required: false })
    declare size?: string;

    @ApiProperty({ required: false })
    declare page?: string;

    @ApiProperty({ required: false })
    declare only?: 'count';
}

export type CountResult = Record<'count', number>;

/**
 * Die Controller-Klasse für die Verwaltung von Autos.
 */
@Controller(paths.rest)
@UseInterceptors(ResponseTimeInterceptor)
@ApiTags('Auto REST-API')
export class AutoController {
    readonly #service: AutoService;

    readonly #logger = getLogger(AutoController.name);

    constructor(service: AutoService) {
        this.#service = service;
    }

    /**
     * Ein Auto wird asynchron anhand seiner ID als Pfadparameter gesucht.
     *
     * Falls es ein solches Auto gibt und `If-None-Match` im Request-Header
     * auf die aktuelle Version des Autos gesetzt war, wird der Statuscode
     * `304` (`Not Modified`) zurückgeliefert. Falls `If-None-Match` nicht
     * gesetzt ist oder eine veraltete Version enthält, wird das gefundene
     * Auto im Rumpf des Response als JSON-Datensatz mit Atom-Links für HATEOAS
     * und dem Statuscode `200` (`OK`) zurückgeliefert.
     *
     * Falls es kein Auto zur angegebenen ID gibt, wird der Statuscode `404`
     * (`Not Found`) zurückgeliefert.
     *
     * @param id Pfad-Parameter `id`
     * @param req Request-Objekt
     * @param version Versionsnummer im Request-Header
     * @param res Leeres Response-Objekt
     * @returns Leeres Promise-Objekt.
     */
    // eslint-disable-next-line max-params
    @Get(':id')
    @Public()
    @ApiOperation({ summary: 'Suche mit der Auto-ID' })
    @ApiParam({
        name: 'id',
        description: 'Z.B. 1',
    })
    @ApiHeader({
        name: 'If-None-Match',
        description: 'Header für bedingte GET-Requests, z.B. "0"',
        required: false,
    })
    @ApiOkResponse({ description: 'Das Auto wurde gefunden' })
    @ApiNotFoundResponse({ description: 'Kein Auto zur ID gefunden' })
    @ApiResponse({
        status: HttpStatus.NOT_MODIFIED,
        description: 'Das Auto wurde bereits heruntergeladen',
    })
    async getById(
        @Param(
            'id',
            new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }),
        )
        id: number,
        @Req() req: Request,
        @Headers('If-None-Match') version: string | undefined,
        @Res() res: Response,
    ): Promise<Response<AutoMitFahrzeugscheinUndAusstattungen>> {
        this.#logger.debug('getById: id=%d, version=%s', id, version ?? '-1');

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('getById: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        const auto = await this.#service.findById({ id });
        this.#logger.debug('getById(): auto=%o', auto);

        const versionDb = auto.version;
        if (version === `"${versionDb}"`) {
            this.#logger.debug('getById: NOT_MODIFIED');
            return res.sendStatus(HttpStatus.NOT_MODIFIED);
        }
        this.#logger.debug('getById: versionDb=%d', versionDb ?? -1);
        res.header('ETag', `"${versionDb}"`);

        this.#logger.debug('getById: auto=%o', auto);
        return res.json(auto);
    }

    /**
     * Autos werden mit Query-Parametern asynchron gesucht. Falls es mindestens
     * ein solches Auto gibt, wird der Statuscode `200` (`OK`) gesetzt. Im Rumpf
     * des Response ist das JSON-Array mit den gefundenen Autos, die jeweils
     * um Atom-Links für HATEOAS ergänzt sind.
     *
     * Falls es kein Auto zu den Suchparameter gibt, wird der Statuscode `404`
     * (`Not Found`) gesetzt.
     *
     * Falls es keine Query-Parameter gibt, werden alle Autos ermittelt.
     *
     * @param query Query-Parameter.
     * @param req Request-Objekt.
     * @param res Leeres Response-Objekt.
     * @returns Leeres Promise-Objekt.
     */
    @Get()
    @Public()
    @ApiOperation({ summary: 'Suche mit Suchparameter' })
    @ApiOkResponse({ description: 'Eine evtl. leere Liste mit Autos' })
    async get(
        @Query() query: AutoQuery,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<Response<Page<Readonly<AutoMitFahrzeugschein>> | CountResult>> {
        this.#logger.debug('get: query=%o', query);

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('get: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        const { only } = query;
        if (only !== undefined) {
            const count = await this.#service.count();
            this.#logger.debug('get: count=%d', count);
            return res.json({ count: count });
        }

        const { page, size } = query;
        delete query['page'];
        delete query['size'];
        this.#logger.debug(
            'get: page=%s, size=%s',
            page ?? 'undefined',
            size ?? 'undefined',
        );

        const keys = Object.keys(query) as (keyof AutoQuery)[];
        keys.forEach((key) => {
            if (query[key] === undefined) {
                delete query[key];
            }
        });
        this.#logger.debug('get: query=%o', query);

        const pageable = createPageable({ number: page, size });
        const autosSlice = await this.#service.find(query, pageable); // NOSONAR
        const autoPage = createPage(autosSlice, pageable);
        this.#logger.debug('get: autoPage=%o', autoPage);

        return res.json(autoPage).send();
    }

    /**
     * Zu einem Auto mit gegebener ID wird die zugehörige Datei heruntergeladen.
     *
     * @param idStr Pfad-Parameter `id`.
     * @param res Leeres Response-Objekt.
     * @returns Leeres Promise-Objekt.
     */
    @Get('/file/:id')
    @Public()
    @ApiOperation({ description: 'Suche nach Datei mit der Auto-ID' })
    @ApiParam({
        name: 'id',
        description: 'Z.B. 1',
    })
    @ApiNotFoundResponse({ description: 'Keine Datei zur Auto-ID gefunden' })
    @ApiOkResponse({ description: 'Die Datei wurde gefunden' })
    async getFileById(
        @Param('id') idStr: string,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        this.#logger.debug('getFileById: autoId:%s', idStr);

        const id = Number(idStr);
        if (!Number.isInteger(id)) {
            this.#logger.debug('getById: not isInteger()');
            throw new NotFoundException(`Die Auto-ID ${idStr} ist ungueltig.`);
        }

        const autoFile = await this.#service.findFileByAutoId(id);
        if (autoFile?.data === undefined) {
            throw new NotFoundException('Keine Datei gefunden.');
        }

        res.contentType(autoFile.mimetype ?? 'image/png').set({
            'Content-Disposition': `inline; filename="${autoFile.filename}"`, // eslint-disable-line @typescript-eslint/naming-convention
        });
        return new StreamableFile(autoFile.data);
    }
}
