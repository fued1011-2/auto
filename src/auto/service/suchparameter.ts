// Copyright (C) 2016 - present Juergen Zimmermann, Hochschule Karlsruhe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

/**
 * Das Modul besteht aus Typdefinitionen für die Suche in `BuchService`.
 * @packageDocumentation
 */

import { type Autoart } from '../../generated/prisma/enums.js';

// Typdefinition für `find`
export type Suchparameter = {
    readonly fin?: string;
    readonly rating?: number | string;
    readonly art?: Autoart;
    readonly preis?: number;
    readonly rabatt?: number;
    readonly verfuegbar?: boolean;
    readonly baujahr?: string;
    readonly homepage?: string;
    readonly allrad?: string;
    readonly benzin?: string;
    readonly budget?: string;
    readonly business?: string;
    readonly cabrio?: string;
    readonly e_auto?: string;
    readonly einfach?: string;
    readonly familie?: string;
    readonly hybrid?: string;
    readonly komfort?: string;
    readonly kombi?: string;
    readonly nutzfahrzeug?: string;
    readonly pickup?: string;
    readonly reichweite?: string;
    readonly sparsam?: string;
    readonly sport?: string;
    readonly suv?: string;
    readonly tech?: string;
    readonly vier_x_vier?: string;
    readonly identifikationsNummer?: string;
};

// gueltige Namen fuer die Suchparameter
export const suchparameterNamen = [
    'fin',
    'rating',
    'art',
    'preis',
    'rabatt',
    'verfuegbar',
    'baujahr',
    'homepage',
    'schlagwoerter',
    'identifikationsNummer',
];
