import {IDriver} from "./IDriver";
import {WebGlDriver} from "./WebGlDriver";
import {CanvasDriver} from "./CanvasDriver";
export class DriverFactory {

    createRenderer(canvas:HTMLCanvasElement): IDriver {
        //return new CanvasDriver(canvas);
        try {
            return new WebGlDriver(canvas);
        }
        catch (e) {
            console.error(e);
            return new CanvasDriver(canvas);
        }
    }
}