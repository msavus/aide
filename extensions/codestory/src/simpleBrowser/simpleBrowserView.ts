/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Disposable } from './dispose';
import { getNonce } from '../utilities/getNonce';
import crypto from 'crypto';

function generateId() {
	return crypto.randomBytes(16).toString('hex');
}

export interface ShowOptions {
	readonly preserveFocus?: boolean;
	readonly displayUrl?: string;
	readonly viewColumn?: vscode.ViewColumn;
}

const enabledHosts = new Set<string>([
	'localhost:*',
	'127.0.0.1:*',
]);

const protocols = ['http', 'https'];

export class SimpleBrowserView extends Disposable {

	public static readonly viewType = 'aide.browser.view';
	private static readonly title = vscode.l10n.t("Web inspector");

	private static getWebviewLocalResourceRoots(extensionUri: vscode.Uri): readonly vscode.Uri[] {
		return [
			vscode.Uri.joinPath(extensionUri, 'media')
		];
	}

	private static getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
		return {
			enableScripts: true,
			enableForms: true,
			localResourceRoots: SimpleBrowserView.getWebviewLocalResourceRoots(extensionUri),
		};
	}

	private readonly _webviewPanel: vscode.WebviewPanel;

	private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
	public readonly onDispose = this._onDidDispose.event;

	public static create(
		extensionUri: vscode.Uri,
		url: string,
		showOptions?: ShowOptions
	): SimpleBrowserView {
		const webview = vscode.window.createWebviewPanel(SimpleBrowserView.viewType, SimpleBrowserView.title, {
			viewColumn: showOptions?.viewColumn ?? vscode.ViewColumn.Active,
			preserveFocus: showOptions?.preserveFocus
		}, {
			retainContextWhenHidden: true,
			...SimpleBrowserView.getWebviewOptions(extensionUri)
		});
		console.log('webview showoptions', showOptions);
		return new SimpleBrowserView(extensionUri, url, webview, showOptions?.displayUrl);
	}

	public static restore(
		extensionUri: vscode.Uri,
		url: string,
		webviewPanel: vscode.WebviewPanel,
		displayUrl?: string,
	): SimpleBrowserView {
		return new SimpleBrowserView(extensionUri, url, webviewPanel, displayUrl);
	}

	private constructor(
		private readonly extensionUri: vscode.Uri,
		url: string,
		webviewPanel: vscode.WebviewPanel,
		private readonly displayUrl?: string,
	) {
		super();

		this._webviewPanel = this._register(webviewPanel);
		this._webviewPanel.webview.options = SimpleBrowserView.getWebviewOptions(extensionUri);

		this._register(this._webviewPanel.webview.onDidReceiveMessage(e => {
			switch (e.type) {
				case 'openExternal':
					try {
						const url = vscode.Uri.parse(e.url);
						vscode.env.openExternal(url);
					} catch {
						// Noop
					}
					break;
			}
		}));

		this._register(this._webviewPanel.onDidDispose(() => {
			this.dispose();
		}));

		this.show(url);
	}

	public override dispose() {
		this._onDidDispose.fire();
		super.dispose();
	}

	public show(url: string, options?: ShowOptions) {
		this._webviewPanel.webview.html = this.getHtml(url);
		this._webviewPanel.reveal(options?.viewColumn, options?.preserveFocus);
	}

	private getHtml(url: string) {
		const mainJs = this.extensionResourceUrl('media', 'index.js');
		const mainCss = this.extensionResourceUrl('media', 'index.css');
		const codiconsUri = this.extensionResourceUrl('media', 'codicon.css');

		const webview = this._webviewPanel.webview;
		const nonce = getNonce();

		let frameSrcs = '';
		const frameHosts = Array.from(enabledHosts);
		for (const protocol of protocols) {
			for (const host of frameHosts) {
				frameSrcs += ` ${protocol}://${host}`;
			}
		}

		const settingsData: Record<string, string> = { url };
		if (this.displayUrl) {
			settingsData.displayUrl = this.displayUrl;
		}

		return /* html */ `<!DOCTYPE html>
			<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src ${webview.cspSource}; font-src ${webview.cspSource} data: https://*.vscode-cdn.net; img-src ${webview.cspSource} blob: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'; frame-src 'self' ${frameSrcs}; worker-src 'self' blob:;">
				<meta id="simple-browser-settings" data-settings="${escapeAttribute(JSON.stringify(settingsData))}">
				<link rel="stylesheet" type="text/css" href="${codiconsUri}">
				<link rel="stylesheet" type="text/css" href="${mainCss}">
			</head>
			<body>
				<header class="header">
					<nav class="controls">
						<button
							title="${vscode.l10n.t("Back")}"
							class="back-button icon"><i class="codicon codicon-arrow-left"></i></button>

						<button
							title="${vscode.l10n.t("Forward")}"
							class="forward-button icon"><i class="codicon codicon-arrow-right"></i></button>

						<button
							title="${vscode.l10n.t("Reload")}"
							class="reload-button icon"><i class="codicon codicon-refresh"></i></button>
					</nav>

					<input class="url-input" type="text">

					<nav class="controls">
						<button
							title="${vscode.l10n.t("Open in browser")}"
							class="open-external-button icon"><i class="codicon codicon-link-external"></i></button>
				</header>
				<div class="content">
					<iframe id="browser" sandbox="allow-scripts allow-forms allow-same-origin allow-downloads"></iframe>
					<div id="root"></div>
				</div>
				<script src="${mainJs}?${generateId()}" type="module" nonce="${nonce}"></script>
			</body>
			</html>`;
	}


	private extensionResourceUrl(...parts: string[]): vscode.Uri {
		return this._webviewPanel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, ...parts));
	}
}

function escapeAttribute(value: string | vscode.Uri): string {
	return value.toString().replace(/"/g, '&quot;');
}