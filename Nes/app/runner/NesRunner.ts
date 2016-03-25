﻿///<reference path="NesRunnerBase.ts"/>

class NesRunner extends NesRunnerBase {

    private callback = this.renderFrame.bind(this);
    private iFrameStart = 0;
    private hpcStart = 0;
    private fpsElement:HTMLElement;

    constructor(container: HTMLElement, url: string) {
         super(container, url);
    }

    protected runI() {
        this.hpcStart = window.performance.now();
        this.iFrameStart = this.nesEmulator.ppu.iFrame;
        this.fpsElement = document.createElement("span");
        this.headerElement.innerText += " ";
        this.headerElement.appendChild(this.fpsElement);
        this.nesEmulator.controller.registerKeyboardHandler('I'.charCodeAt(0), () => {this.headerElement.classList.toggle('show')});
        requestAnimationFrame(this.callback);
        //setInterval(this.printFps.bind(this), 1000);
    }
    private printFps() {
        var hpcNow = Date.now();
        const dt = hpcNow - this.hpcStart;
        if (dt > 1000) {
            const fps = (this.nesEmulator.ppu.iFrame - this.iFrameStart) / dt * 1000;
            this.fpsElement.innerText = `${Math.round(fps * 100) / 100} fps`;
            this.iFrameStart = this.nesEmulator.ppu.iFrame;
            this.hpcStart = hpcNow;
        }
    }

    private renderFrame(hpcNow) {
        const nesEmulator = this.nesEmulator;
        const ppu = nesEmulator.ppu;
        
        const frameCurrent = ppu.iFrame;
        while (frameCurrent === ppu.iFrame)
            nesEmulator.step();
      
        this.printFps();
        requestAnimationFrame(this.callback);
    }
}