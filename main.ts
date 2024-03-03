import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFolder } from 'obsidian';
import { ExpressServer } from 'exp-server';


interface CatchPluginSettings {
	port: string;
	inboxFolder: string;
	webserver: boolean;
	template: string;
}

const DEFAULT_SETTINGS: CatchPluginSettings = {
	port: '8980',
	inboxFolder: '',
	webserver: false,
	template: ''
}

export default class CatchPlugin extends Plugin {
	private expressServer: ExpressServer;
	settings: CatchPluginSettings;
	rootFolders: Record<string, string>;
	statusBar: HTMLElement;

	startExpressServer(): void {
		this.expressServer = new ExpressServer(this, this.settings.port || '8980');
		this.expressServer.start();

		this.statusBar = this.addStatusBarItem();
		this.statusBar.createEl("span", { text: `Catch server [port ${this.expressServer.getUrl().port.toString()}]` });
	};

	stopExpressServer(): void {
		this.expressServer.stop();
		this.statusBar.remove();
	};

	addToInbox(path: string): string {
		let filename = `${path}.md`,
			body = this.settings.template || "",
			inboxFolder = this.settings.inboxFolder,
			msg = `✅ '${filename}' created in '${inboxFolder}'`;
		this.app.vault.create(`${inboxFolder}/${filename}`, body)
			.catch((e: any) => {
				msg = `🚫 Error: ${e}`;
			})
		new Notice(msg);
		return msg;
	};

	async onload() {
		this.rootFolders = { '/': '/ (vault-level)' };
		let rootAll: TAbstractFile[] = this.app.vault.getRoot().children;
		rootAll.forEach(element => {
			if (element instanceof TFolder) {
				this.rootFolders['/' + element.path] = element.name;
			}
		});

		await this.loadSettings();

		//@ts-ignore
		const ribbonIconEl = this.addRibbonIcon('parking-square', `Catch (${this.app.hotkeyManager.printHotkeyForCommand('catch:catch-command')})`, (evt: MouseEvent) => {
			new CatchModal(this.app, (result) => this.addToInbox(result)).open();
		});

		this.addCommand({
			id: 'catch-command',
			name: 'Catch to Inbox',
			callback: () => {
				new CatchModal(this.app, (result) => this.addToInbox(result)).open();
			}
		});

		this.addSettingTab(new CatchSettingTab(this.app, this));

	}

	onunload() {
		if (this.settings.webserver)
			this.stopExpressServer();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		if (this.settings.inboxFolder == '') {
			new Notice('🚩 Configure to get started...');
		}
		if (this.settings.webserver) {
			this.startExpressServer();
		}
	}

	async saveSettings(previous: any) {
		if (this.settings.webserver && previous === 'webserver:false') {
			this.startExpressServer();
		} else if (!this.settings.webserver && previous === 'webserver:true') {
			this.stopExpressServer();
		}
		await this.saveData(this.settings);
	}
}

class CatchModal extends Modal {
	result: string;
	onSubmit: (result: string) => void;

	constructor(app: App, onSubmit: (result: string) => void) {
		// constructor(app: App) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		this.containerEl.addClass('catch__modal');
		contentEl.createEl('input', { placeholder: 'Catch your idea for later...', cls: 'catch__input modal-input' })
			.addEventListener('keypress', (e) => {
				if (e.key === 'Enter') {
					this.result = (e.target as HTMLInputElement).value;
					this.close();
					this.onSubmit(this.result);
				}
			});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class CatchSettingTab extends PluginSettingTab {
	plugin: CatchPlugin;

	constructor(app: App, plugin: CatchPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Inbox folder')
			.setDesc('Which top-level folder should caught ideas be stored?')
			.addDropdown(dropdown => dropdown
				.addOptions(this.plugin.rootFolders)
				.setValue(this.plugin.settings.inboxFolder)
				.onChange(async (value) => {
					let prev = `inboxFolder:${this.plugin.settings.inboxFolder}`;
					this.plugin.settings.inboxFolder = value;
					await this.plugin.saveSettings(prev);
				}));

		new Setting(containerEl)
			.setName('Web Server')
			.setDesc('Do you want to use an ExpressJS web server to listen for a hotkey client?')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.webserver)
				.onChange(async (value) => {
					let prev = `webserver:${this.plugin.settings.webserver}`;
					this.plugin.settings.webserver = value;
					await this.plugin.saveSettings(prev);
					portSetting.setDisabled(value);
				}));

		const portSetting: Setting = new Setting(containerEl)
			.setName('Web Server Port')
			.setDesc('What port should the web server listen on?')
			.addText(text => text
				.setValue(this.plugin.settings.port)
				.onChange(async (value) => {
					let prev = `port:${this.plugin.settings.port}`;
					this.plugin.settings.port = value;
					await this.plugin.saveSettings(prev);
				}));

		if (this.plugin.settings.webserver) {
			portSetting.setDisabled(true);
		}

		new Setting(containerEl)
			.setName('Template')
			.setDesc('What should the default note contain?')
			.addTextArea(textarea => textarea
				.setPlaceholder('Put your quick capture markdown here...')
				.setValue(this.plugin.settings.template)
				.onChange(async (value: string) => {
					let prev = `template:${this.plugin.settings.template}`;
					this.plugin.settings.template = value;
					await this.plugin.saveSettings(prev);
				})
				.inputEl.setAttrs({ rows: 6, cols: 60 }));
	}
}