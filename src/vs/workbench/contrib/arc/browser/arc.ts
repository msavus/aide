/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IArcViewModel } from 'vs/workbench/contrib/arc/common/arcViewModel';

export const IArcWidgetService = createDecorator<IArcWidgetService>('arcWidgetService');

export interface IArcWidgetService {
	readonly _serviceBrand: undefined;

	hide(): void;
	show(): void;
	toggle(): void;
}

export interface IArcWidget {
	readonly viewModel: IArcViewModel | undefined;
}