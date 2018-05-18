import {Transport, TransportHandlers, WSTransport} from "./transport";
import {extend} from "./util";
import {ClientEventMap} from "./nats";
import {ClientHandlers, ProtocolHandler, Sub, MsgCallback, Subscription} from "./protocol";
import {NatsError} from "./error";
import * as util from "util";

export const BAD_SUBJECT_MSG = 'Subject must be supplied';


export interface NatsConnectionOptions {
    url: string
}

export interface Callback {
    ():void;
}


export interface ErrorCallback {
    (error: Error): void;
}

export interface ClientEventMap {
    close: Callback;
    error: ErrorCallback;
}

export interface SubscribeOptions {
    queue?: string;
    max?: number;
}


export class NatsConnection implements ClientHandlers {
    options: NatsConnectionOptions;
    transport!: Transport;
    protocol!: ProtocolHandler;
    closeListeners: Callback[] = [];
    errorListeners: ErrorCallback[] = [];

    private constructor(opts: NatsConnectionOptions) {
        this.options = {url: "ws://localhost:4222"} as NatsConnectionOptions;
        extend(this.options, opts);
    }

    public static connect(opts: NatsConnectionOptions): Promise<NatsConnection> {
        return new Promise<NatsConnection>((resolve, reject) => {
            let nc = new NatsConnection(opts);
            ProtocolHandler.connect(opts, nc)
                .then((ph) => {
                    nc.protocol = ph;
                    nc.transport = ph.transport;
                    resolve(nc);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

    close() : void {
        this.protocol.close();
    }

    publish(subject: string, data: string) {
        subject = subject || "";
        if(subject.length === 0) {
            this.errorHandler(new Error("subject required"));
            return;
        }
        data = data || "";
        let m = "PUB " + subject + " " + data.length + "\r\n" + data + "\r\n";

        this.protocol.sendCommand(m);
    }

    subscribe(subject: string, cb: MsgCallback, opts: SubscribeOptions = {}) : Promise<Subscription> {
        return new Promise<Subscription>((resolve, reject) => {
            if(this.isClosed()) {
                //FIXME: proper error
                reject(new NatsError("closed", "closed" ));
            }

            let s = {} as Sub;
            extend(s, opts);
            s.subject = subject;
            s.callback = cb;
            resolve(this.protocol.subscribe(s));
        });
    }

    flush(f?: Function): void {
        this.protocol.flush(f);
    }


    errorHandler(error: Error): void {
        this.errorListeners.forEach((cb) => {
            try {cb(error);}catch(ex) {}
        });
    }

    closeHandler(): void {
        this.closeListeners.forEach((cb) => {
            try {cb();}catch(ex) {}
        });
    }

    addEventListener<K extends keyof ClientEventMap>(type: K, listener: (this: NatsConnection, ev: ClientEventMap[K][]) => void): void {
        if (type === "close") {
            //@ts-ignore
            this.closeListeners.push(listener);
        } else if (type === "error") {
            //@ts-ignore
            this.errorListeners.push(listener);
        }
    }

    isClosed() : boolean {
        return this.transport.isClosed();
    }

}





