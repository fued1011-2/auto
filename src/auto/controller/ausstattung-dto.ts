/**
 * Das Modul besteht aus der Entity-Klasse.
 * @packageDocumentation
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    MaxLength,
    Validate,
    type ValidationArguments,
    ValidatorConstraint,
    type ValidatorConstraintInterface,
} from 'class-validator';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Wandelt einen numerischen Eingabewert in eine Decimal-Instanz um.
 */
const number2Decimal = ({ value }: { value: number | string | undefined }) => {
    if (value === undefined || value === null) {
        return;
    }

    try {
        return new Decimal(value);
    } catch {
        return undefined;
    }
};

/**
 * Custom Validator: Prüft, ob eine Decimal >= Mindestwert ist.
 */
@ValidatorConstraint({ name: 'decimalMin', async: false })
class DecimalMin implements ValidatorConstraintInterface {
    validate(value: Decimal | undefined, args: ValidationArguments) {
        if (value === undefined) {
            return true;
        }

        const [minValueRaw] = args.constraints;
        const minValue = minValueRaw as Decimal;

        if (!minValue) {
            return true;
        }

        return value.greaterThanOrEqualTo(minValue);
    }

    defaultMessage(args: ValidationArguments) {
        const [minValueRaw] = args.constraints;
        const minValue = minValueRaw as Decimal;
        return `Der Wert muss größer oder gleich ${minValue.toString()} sein.`;
    }
}

/**
 * Entity-Klasse für Ausstattung.
 */
export class AusstattungDTO {
    @MaxLength(32)
    @ApiProperty({ example: 'Navigation', type: String })
    readonly bezeichnung!: string;

    @MaxLength(128)
    @ApiProperty({ example: 'Navi mit Touchscreen', type: String })
    readonly beschreibung!: string;

    @Transform(number2Decimal)
    @Validate(DecimalMin, [new Decimal(0)], {
        message: 'preis muss positiv sein.',
    })
    @ApiProperty({ example: 999, type: Number })
    readonly preis!: Decimal;
}

/* eslint-enable @typescript-eslint/no-magic-numbers */
