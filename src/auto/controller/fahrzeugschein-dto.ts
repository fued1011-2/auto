/**
 * Das Modul besteht aus der Entity-Klasse.
 * @packageDocumentation
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */

import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, Matches, MaxLength } from 'class-validator';

/**
 * Entity-Klasse für Fahrzeugschein.
 */
export class FahrzeugscheinDTO {
    @Matches(/^[A-ZÄÖÜ]{1,3}-[A-Z]{1,3}\d{1,4}$/)
    @MaxLength(10)
    @ApiProperty({ example: 'AB-CD1234', type: String })
    readonly identifikationsNummer!: string;

    @IsISO8601({ strict: true })
    @ApiProperty({ example: '2021-01-31' })
    readonly erstzulassung!: Date | string;

    @IsISO8601({ strict: true })
    @ApiProperty({ example: '2021-01-31' })
    readonly gueltigBis!: Date | string;
}
/* eslint-enable @typescript-eslint/no-magic-numbers */
