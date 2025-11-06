import { UseFilters, UseInterceptors } from '@nestjs/common';
import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import BigNumber from 'bignumber.js'; // eslint-disable-line @typescript-eslint/naming-convention
import { Public } from 'nest-keycloak-connect';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import {
    AutoService,
    type AutoMitFahrzeugschein,
    type AutoMitFahrzeugscheinUndAusstattungen,
} from '../service/auto-service.js';
import { createPageable } from '../service/pageable.js';
import { Slice } from '../service/slice.js';
import { Suchparameter } from '../service/suchparameter.js';
import { HttpExceptionFilter } from './http-exception-filter.js';

export type IdInput = {
    readonly id: string;
};

export type SuchparameterInput = {
    readonly suchparameter: Omit<Suchparameter, 'verfuegbar'> & {
        verfuegbar: boolean | undefined;
    };
};

@Resolver('Auto')
@UseFilters(HttpExceptionFilter)
@UseInterceptors(ResponseTimeInterceptor)
export class AutoQueryResolver {
    readonly #service: AutoService;

    readonly #logger = getLogger(AutoQueryResolver.name);

    constructor(service: AutoService) {
        this.#service = service;
    }

    @Query('auto')
    @Public()
    async findById(
        @Args() { id }: IdInput,
    ): Promise<Readonly<AutoMitFahrzeugscheinUndAusstattungen>> {
        this.#logger.debug('findById: id=%s', id);

        const auto: Readonly<AutoMitFahrzeugscheinUndAusstattungen> =
            await this.#service.findById({ id: Number(id) });

        this.#logger.debug('findById: auto=%o', auto);
        return auto;
    }

    @Query('autos')
    @Public()
    async find(
        @Args() input: SuchparameterInput | undefined,
    ): Promise<AutoMitFahrzeugschein[]> {
        this.#logger.debug('find: input=%s', JSON.stringify(input));
        const pageable = createPageable({});
        const suchparameter = input?.suchparameter;
        if (suchparameter !== undefined) {
            const { verfuegbar } = suchparameter;
            if (verfuegbar !== undefined) {
                (suchparameter as any).verfuegbar = verfuegbar.toString();
            }
        }
        const autosSlice: Readonly<Slice<Readonly<AutoMitFahrzeugschein>>> =
            await this.#service.find(suchparameter as any, pageable); // NOSONAR
        this.#logger.debug('find: autosSlice=%o', autosSlice);
        return autosSlice.content;
    }

    @ResolveField('rabatt')
    rabatt(@Parent() auto: AutoMitFahrzeugschein, short: boolean | undefined) {
        this.#logger.debug(
            'rabatt: auto=%o, short=%s',
            auto,
            short?.toString() ?? 'undefined',
        );
        const rabatt = auto.rabatt ?? BigNumber(0);
        const shortStr = short === undefined || short ? '%' : 'Prozent';
        return `${rabatt.toString()} ${shortStr}`;
    }
}
