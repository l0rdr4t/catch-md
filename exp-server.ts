import express from 'express';
import { Server } from 'http';
import CatchPlugin from 'main';

export class ExpressServer {
    private _app: express.Application;
    private _port = 8980;
    private _server: Server;
    private _plugin: CatchPlugin;

    constructor(plugin: any, port: string) {
        const numPort = Number(port);
        this._port = isNaN(numPort) ? 8980 : numPort;
        this._app = express();
        this._plugin = plugin;
    }

    getUrl(): URL {
        return new URL(`http://localhost:${this._port}`);
    }

    start() {
        this._app.get('/', async (req, res) => {
            let msg = 'connection test OK.';
            console.log(`[plugin:catch] [${req.ip}] GET ${req.url.toString()}: ${msg}`);
            res.send('Success');
        });

        this._app.post(/^\/[^/?&#]{1,80}$/, async (req, res) => {
            let msg = this._plugin.addToInbox(req.url.slice(1).replace(/\+/g, ' '));
            console.log(`[plugin:catch] [${req.ip}] POST ${req.url.toString()}: ${msg}.`);
            res.send('Success');
        });

        this._server = this._app
            .listen(this._port, '127.0.0.1', () => {
                // tslint:disable-next-line:no-console
                console.log(`[plugin:catch] server started at http://localhost:${this._port}.`);
            })
            .on('error', err => {
                console.log(`[plugin:catch] port ${this._port} already in use.`);
            });
    }

    stop() {
        this._server.close();
        console.log(`[plugin:catch] server stopped`);
    }
}