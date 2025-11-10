// eslint-disable-next-line max-classes-per-file
import { UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { IsInt, IsNumberString, Min } from 'class-validator';
import { AuthGuard, Roles } from 'nest-keycloak-connect';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import { AutoDTO } from '../controller/auto-dto.js';
import {
    AutoWriteService,
    AutoCreate,
    AutoUpdate,
} from '../service/auto-write-service.js';
import { type IdInput } from './query.js';
import { HttpExceptionFilter } from './http-exception-filter.js';

export type CreatePayload = {
    readonly id: number;
};

export type UpdatePayload = {
    readonly version: number;
};

export type DeletePayload = {
    readonly success: boolean;
};

export class AutoUpdateDTO extends AutoDTO {
    @IsNumberString()
    readonly id!: string;

    @IsInt()
    @Min(0)
    readonly version!: number;
}
@Resolver('Auto')
@UseGuards(AuthGuard)
@UseFilters(HttpExceptionFilter)
@UseInterceptors(ResponseTimeInterceptor)
export class AutoMutationResolver {
    readonly #service: AutoWriteService;

    readonly #logger = getLogger(AutoMutationResolver.name);

    constructor(service: AutoWriteService) {
        this.#service = service;
    }

    @Mutation()
    @Roles('admin', 'user')
    async create(@Args('input') autoDTO: AutoDTO) {
        this.#logger.debug('create: autoDTO=%o', autoDTO);

        const auto = this.#autoDtoToAutoCreate(autoDTO);
        const id = await this.#service.create(auto);
        this.#logger.debug('createAuto: id=%d', id);
        const payload: CreatePayload = { id };
        return payload;
    }

    @Mutation()
    @Roles('admin', 'user')
    async update(@Args('input') autoDTO: AutoUpdateDTO) {
        this.#logger.debug('update: auto=%o', autoDTO);

        const auto = this.#autoUpdateDtoToAutoUpdate(autoDTO);
        const versionStr = `"${autoDTO.version.toString()}"`;

        const versionResult = await this.#service.update({
            id: Number.parseInt(autoDTO.id, 10),
            auto,
            version: versionStr,
        });
        this.#logger.debug('updateAuto: versionResult=%d', versionResult);
        const payload: UpdatePayload = { version: versionResult };
        return payload;
    }

    @Mutation()
    @Roles('admin')
    async delete(@Args() id: IdInput) {
        const idValue = id.id;
        this.#logger.debug('delete: idValue=%s', idValue);
        await this.#service.delete(Number(idValue));
        const payload: DeletePayload = { success: true };
        return payload;
    }

    #autoDtoToAutoCreate(autoDTO: AutoDTO): AutoCreate {
        // "Optional Chaining" ab ES2020
        const ausstattungen = autoDTO.ausstattungen?.map((ausstattungenDTO) => {
            const ausstattung = {
                bezeichnung: ausstattungenDTO.bezeichnung,
                beschreibung: ausstattungenDTO.beschreibung,
                preis: ausstattungenDTO.preis,
            };
            return ausstattung;
        });
        const auto: AutoCreate = {
            version: 0,
            fin: autoDTO.fin,
            rating: autoDTO.rating,
            art: autoDTO.art ?? null,
            preis: autoDTO.preis.toNumber(),
            rabatt: autoDTO.rabatt?.toNumber() ?? 0,
            verfuegbar: autoDTO.verfuegbar ?? false,
            baujahr: autoDTO.baujahr ?? null,
            homepage: autoDTO.homepage ?? null,
            schlagwoerter: autoDTO.schlagwoerter ?? [],
            fahrzeugschein: {
                create: {
                    identifikationsNummer: autoDTO.fahrzeugschein.identifikationsNummer,
                    erstzulassung: autoDTO.fahrzeugschein.erstzulassung,
                    gueltigBis: autoDTO.fahrzeugschein.gueltigBis,
                },
            },
            ausstattungen: { create: ausstattungen ?? [] },
        };
        return auto;
    }

    #autoUpdateDtoToAutoUpdate(autoDTO: AutoUpdateDTO): AutoUpdate {
        return {
            fin: autoDTO.fin,
            rating: autoDTO.rating,
            art: autoDTO.art ?? null,
            preis: autoDTO.preis.toNumber(),
            rabatt: autoDTO.rabatt?.toNumber() ?? 0,
            verfuegbar: autoDTO.verfuegbar ?? false,
            baujahr: autoDTO.baujahr ?? null,
            homepage: autoDTO.homepage ?? null,
            schlagwoerter: autoDTO.schlagwoerter ?? [],
        };
    }
}
