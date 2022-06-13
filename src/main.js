
import createEventEmitter from '@kirick/event-emitter';
import WebSocket          from 'ws';

import { PAYLOAD_TYPE,
         createPayload,
         parsePayload } from './payload';

const BROKEN_STATES = new Set([
    WebSocket.CLOSING,
    WebSocket.CLOSED,
]);
const OPTIONS_DEFAULT = {
    connect: true,
    reconnect: true,
    reconnect_interval: 2000,
    ping_timeout: 5000,
};

export default class ExtWSClient {
    constructor (url, options = {}) {
        this.url = new URL(url);
        this.options = options;

        this._ws = null;

        this._emitter = createEventEmitter();

        this._toid_ping = null;
		this._toid_dead = null;
		this._toid_reconnect = null;

        if (this._getOption('connect') === true) {
			setTimeout(
				() => this.connect(),
			);
		}

        this.on(
			'disconnect',
			() => {
				this._ws = null;

				if (this._getOption('reconnect') === true) {
					clearTimeout(this._toid_reconnect);

					this._toid_reconnect = setTimeout(
						() => this.connect(),
						this._getOption('reconnect_interval'),
					);
				}
			},
		);
    }

	_getOption (key) {
        return this.options[key] ?? OPTIONS_DEFAULT[key];
    }

    get is_connected () {
        return this._ws
            && BROKEN_STATES.has(this._ws.readyState) !== true
            && Date.now() - this._ws._extws.ts_last_message < this._ws._extws.idle_timeout;
    }

    get id () {
        return this._ws._extws.socket_id;
    }

    _createPing () {
        clearTimeout(this._toid_ping);

        if (this._ws) {
            this._toid_ping = setTimeout(
                () => this._sendPing(),
                this._ws._extws.idle_timeout - this._getOption('ping_timeout'),
            );
        }
    }

    _sendPing () {
        clearTimeout(this._toid_dead);

        if (this.is_connected) {
            this._ws.send(
                createPayload(
                    PAYLOAD_TYPE.PING,
                ),
            );

            this._toid_dead = setTimeout(
                () => this.disconnect(),
                this._getOption('ping_timeout') * 1e3,
            );
        }
    }

    connect () {
        if (this.is_connected) {
            return;
        }

        if (this._ws) {
            this._ws.close();
        }

        this._emitter.emit('beforeconnect');

        const ws = this._ws = new WebSocket(this.url);
        ws._extws = {
            socket_id: null,
            idle_timeout: 60_000,
            ts_last_message: 0,
        };

        ws.addEventListener(
            'error',
            (error) => {
                console.error(error);
            },
        );

        ws.addEventListener(
            'open',
            () => {
                // console.log('open');

                ws._extws.ts_last_message = Date.now();
                this._emitter.emit('connect');

                this._createPing();
            },
        );

        ws.addEventListener(
            'message',
            ev => {
                clearTimeout(this._toid_dead);
                this._createPing();

                ws._extws.ts_last_message = Date.now();

                const {
                    type,
                    data,
                    event_type,
                } = parsePayload(ev.data);
                // console.log(type, data, event_type);

                switch (type) {
                    case PAYLOAD_TYPE.INIT:
                        ws._extws.socket_id = data.id;
                        ws._extws.idle_timeout = data.idle_timeout * 1000;
                    break;
                    case PAYLOAD_TYPE.PING:
                        ws.send(
                            createPayload(PAYLOAD_TYPE.PONG),
                        );
                    break;
                    case PAYLOAD_TYPE.MESSAGE:
                        this._emitter.emit(
                            event_type ?? 'message',
                            data,
                        );
                    break;
                    // no default
                }
            },
        );

        ws.addEventListener(
            'close',
            () => {
                ws._extws.ts_last_message = 0;
                this._emitter.emit('disconnect');
            },
        );
    }

    disconnect () {
        clearTimeout(this._toid_reconnect);

        if (this._ws) {
            this._ws.close();
        }
    }

	on (...args) {
        return this._emitter.on(...args);
    }

	once (...args) {
        return this._emitter.once(...args);
    }

    emit (event_type, data) {
        if (
            undefined === data
            && typeof event_type !== 'string'
        ) {
            data = event_type;
            event_type = undefined;
        }

        if (this.is_connected) {
            this._ws.send(
                createPayload(
                    PAYLOAD_TYPE.MESSAGE,
                    data,
                    event_type,
                ),
            );
        }
    }
}
