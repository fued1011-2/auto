/**
 * Das Modul besteht aus der Entity-Klasse.
 * @packageDocumentation
 */

/* eslint-disable max-classes-per-file, @typescript-eslint/no-magic-numbers */

import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsISO8601,
    IsInt,
    IsOptional,
    IsString,
    IsUrl,
    Matches,
    Max,
    Min,
    Validate,
    ValidateNested,
    type ValidationArguments,
    ValidatorConstraint,
    type ValidatorConstraintInterface,
} from 'class-validator';
import BigNumber from 'bignumber.js';
import { AusstattungDTO } from './ausstattung-dto.js';
import { FahrzeugscheinDTO } from './fahrzeugschein-dto.js';
import { Autoart } from '../../generated/prisma/enums.js';

export const MAX_RATING = 5;

const number2Decimal = ({ value }: { value: BigNumber.Value | undefined }) => {
    if (value === undefined) {
        return;
    }
    BigNumber.set({ DECIMAL_PLACES: 6 });
    return BigNumber(value);
};

const number2Percent = ({ value }: { value: BigNumber.Value | undefined }) => {
    if (value === undefined) {
        return;
    }

    BigNumber.set({ DECIMAL_PLACES: 4 });
    return BigNumber(value);
};

@ValidatorConstraint({ name: 'decimalMin', async: false })
class DecimalMin implements ValidatorConstraintInterface {
    validate(value: BigNumber | undefined, args: ValidationArguments) {
        if (value === undefined) {
            return true;
        }
        const [minValue]: BigNumber[] = args.constraints; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        return value.isGreaterThan(minValue!);
    }

    defaultMessage(args: ValidationArguments) {
        return `Der Wert muss groesser oder gleich ${(args.constraints[0] as BigNumber).toNumber()} sein.`;
    }
}

@ValidatorConstraint({ name: 'decimalMax', async: false })
class DecimalMax implements ValidatorConstraintInterface {
    validate(value: BigNumber | undefined, args: ValidationArguments) {
        if (value === undefined) {
            return true;
        }
        const [maxValue]: BigNumber[] = args.constraints; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        return value.isLessThan(maxValue!);
    }

    defaultMessage(args: ValidationArguments) {
        return `Der Wert muss kleiner oder gleich ${(args.constraints[0] as BigNumber).toNumber()} sein.`;
    }
}

/**
 * Entity-Klasse für Autos ohne Referenzen.
 */
export class AutoDtoOhneRef {
    @IsString()
    @Matches(/^[A-HJ-NPR-Z0-9]{17}$/u, {
        message: 'FIN muss 17 Zeichen lang sein und darf nur Großbuchstaben (außer I,O,Q) und Ziffern enthalten.',
    })
    @ApiProperty({ example: 'WDB123456789XYZ01', type: String })
    readonly fin!: string;

    @IsInt()
    @Min(0)
    @Max(MAX_RATING)
    @ApiProperty({ example: 5, type: Number })
    readonly rating!: number;

    @Matches(/^(SUV|CABRIO|LIMOUSINE|E_AUTO|KOMBI|PICKUP|CROSSOVER)$/u)
    @IsOptional()
    @ApiProperty({ example: 'CABRIO', type: String })
    readonly art: Autoart | undefined;

    @Transform(number2Decimal)
    @Validate(DecimalMin, [BigNumber(0)], {
        message: 'preis muss positiv sein.',
    })
    @ApiProperty({ example: 3999, type: Number })
    readonly preis!: BigNumber;

    @Transform(number2Percent)
    @Validate(DecimalMin, [BigNumber(0)], {
        message: 'rabatt muss positiv sein.',
    })
    @Validate(DecimalMax, [BigNumber(1)], {
        message: 'rabatt muss kleiner 1 sein.',
    })
    @IsOptional()
    @ApiProperty({ example: 0.1, type: Number })
    readonly rabatt: BigNumber | undefined;

    @IsBoolean()
    @IsOptional()
    @ApiProperty({ example: true, type: Boolean })
    readonly verfuegbar: boolean | undefined;

    @IsISO8601({ strict: true })
    @IsOptional()
    @ApiProperty({ example: '2021-01-31' })
    readonly baujahr: Date | string | undefined;

    @IsUrl()
    @IsOptional()
    @ApiProperty({ example: 'https://test.de/', type: String })
    readonly homepage: string | undefined;

    @IsOptional()
    @ArrayUnique()
    @ApiProperty({ example: ['FAMILIE', 'ALLRAD', 'SPORT', 'HYBRID'] })
    readonly schlagwoerter: string[] | undefined;
}

/**
 * Entity-Klasse für Autos.
 */
export class AutoDTO extends AutoDtoOhneRef {
    @ValidateNested()
    @Type(() => FahrzeugscheinDTO)
    @ApiProperty({ type: FahrzeugscheinDTO })
    readonly fahrzeugschein!: FahrzeugscheinDTO;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AusstattungDTO)
    @ApiProperty({ type: [AusstattungDTO] })
    readonly ausstattungen: AusstattungDTO[] | undefined;
}
/* eslint-enable max-classes-per-file, @typescript-eslint/no-magic-numbers */
